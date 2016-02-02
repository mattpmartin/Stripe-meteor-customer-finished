if (Meteor.isClient) {
  Meteor.startup(function(){
    Stripe.setPublishableKey(Meteor.settings.public.StripePub);
  });

  Session.setDefault("hasAttachedCard", true);

  Template.body.helpers({
    "hasAttachedCard": function(){
      return Session.get("hasAttachedCard");
    },
    "loadingCardInfo": function(){
      loadCardInfo();
      return Session.get("loadingCardInfo");
    },
    "cardInfo": function(){
      return Session.get("cardInfo");
    }
  });

  function loadCardInfo(){
    Meteor.call("loadCardInfo", function(err, data){
      if(err == null){
        Session.set("hasAttachedCard", data.hasCard);
        if(data.hasCard){
          Session.set("cardInfo", data.cardInfo);
          Session.set("loadingCardInfo", false);
        }
      }
    });
  }

  Template.body.events({
    "submit .payment-form": function(event){
      event.preventDefault();

      var cardDetails = {
        "number": event.target.cardNumber.value,
        "cvc": event.target.cardCVC.value,
        "exp_month": event.target.cardExpiryMM.value,
        "exp_year": event.target.cardExpiryYY.value
      }

      Stripe.createToken(cardDetails, function(status, result){
        if(result.error){
          alert(result.error.message);
        }else{
          Meteor.call("addCard", result.id, function(err, response){
            if(err){
              alert(err.message);
            }else{
              loadCardInfo();
              alert("Card Saved")
            }
          })
        }
      })
    },
    "click #chargeUser": function(event){
      Meteor.call("chargeUser", function(err, response){
        if(err){
          alert(err.message);
        }else{
          alert("The user was charged")
        }
      })
    }
  })
}

if (Meteor.isServer) {
  var stripe = StripeAPI(Meteor.settings.StripePri);

  Meteor.methods({
    "addCard": function(cardToken){
      if(Meteor.user().stripeCust == null){
        var custCreate = Async.runSync(function(done){
          stripe.customers.create({
            source: cardToken
          }, function(err, response){
            done(err, response);
          })
        })

        if(custCreate.error){
          throw new Meteor.error(500, "stripe-error", custCreate.error.message);
        }else{
          Meteor.users.update(Meteor.userId(), {$set: {stripeCust: custCreate.result.id}});
          return
        }
      }else{
        var custUpdate = Async.runSync(function(done){
          stripe.customers.update(Meteor.user().stripeCust,{
            source: cardToken
          }, function(err, result) {
            done(err, result);
          })
        })

        if(custUpdate.error){
          throw new Meteor.error(500, "stripe-error", custUpdate.error.message);
        }else{
          return
        }
      }
    },
    "loadCardInfo": function(){
      if(Meteor.user().stripeCust == null){
        return {
          "hasCard": false
        }
      }else{
        var custDetails = Async.runSync(function(done){
          stripe.customers.retrieve(Meteor.user().stripeCust, function(err, result){
            done(err, result);
          })
        })

        if(custDetails.result.sources.data.length == 0){
          return {
            "hasCard": false
          }
        }else{
          var cardDetails = custDetails.result.sources.data[0];

          return {
            "hasCard": true,
            "cardInfo": {
              "brand": cardDetails.brand,
              "exp_month": cardDetails.exp_month,
              "exp_year": cardDetails.exp_year,
              "last4": cardDetails.last4
            }
          }
        }
      }
    },
    "chargeUser": function(){
      stripe.charges.create({
        amount: 500,
        currency: "aud",
        customer: Meteor.user().stripeCust
      }, function(err, result){
        if(err){
          throw new Meteor.error(500, "stripe-error", err.message);
        }else{
          console.log(result);
          return result;
        }
      })
    }
  })
}

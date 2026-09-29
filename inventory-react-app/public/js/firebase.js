/* Firebase initialization for the inventory app. */
(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyA6nB3O6JKyjf02kWWgjcX9gUIX82wPC4s",
    authDomain: "inventory2-b10cb.firebaseapp.com",
    databaseURL: "https://inventory2-b10cb-default-rtdb.firebaseio.com",
    projectId: "inventory2-b10cb",
    storageBucket: "inventory2-b10cb.firebasestorage.app",
    messagingSenderId: "820736013235",
    appId: "1:820736013235:web:8d7841ee3432a9670311c6",
    measurementId: "G-7SB35L5XFN",
  };

  if (typeof firebase !== "undefined") {
    try {
      firebase.initializeApp(firebaseConfig);
      if (firebase.analytics) {
        firebase.analytics();
      }

      // Initialize database reference for chat
      window.FirebaseDB = firebase.database();
      window.FirebaseAuth = {
        register: function (email, password, displayName) {
          return firebase.auth().createUserWithEmailAndPassword(email, password).then(function (result) {
            return result.user.updateProfile({ displayName: displayName }).then(function () {
              return result.user;
            });
          });
        },
        login: function (email, password) {
          return firebase.auth().signInWithEmailAndPassword(email, password).then(function (result) {
            return result.user;
          });
        },
        logout: function () {
          return firebase.auth().signOut();
        },
      };

      window.DB = {
        ref: firebase.database().ref("inventory"),
        sync: function (data) {
          return window.DB.ref.set(data);
        },
      };
      console.log("Firebase initialized successfully for project:", firebaseConfig.projectId);
    } catch (e) {
      console.error("Firebase initialization failed:", e);
    }
  } else {
    console.warn("Firebase SDK not loaded");
  }
})();

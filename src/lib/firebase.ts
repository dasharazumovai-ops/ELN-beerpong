import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase's client config is not a secret — it identifies the project, not a credential.
// Access is controlled by Firestore security rules, not by hiding these values.
const firebaseConfig = {
  apiKey: 'AIzaSyDomi7jYyy0FR78wQn98T9ugOjrXSFg0Fs',
  authDomain: 'eln-activities.firebaseapp.com',
  projectId: 'eln-activities',
  storageBucket: 'eln-activities.firebasestorage.app',
  messagingSenderId: '680958609190',
  appId: '1:680958609190:web:4005bc8de88321c93323e7',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDomi7jYyy0FR78wQn98T9ugOjrXSFg0Fs',
  authDomain: 'eln-activities.firebaseapp.com',
  projectId: 'eln-activities',
  storageBucket: 'eln-activities.firebasestorage.app',
  messagingSenderId: '680958609190',
  appId: '1:680958609190:web:4005bc8de88321c93323e7',
  measurementId: 'G-WCT7F43PLQ',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// One shared document holds the whole live tournament — a single ongoing event doesn't need
// more than that, and it keeps the live-view side trivially simple (one doc to subscribe to).
export const LIVE_TOURNAMENT_DOC = { collection: 'liveTournaments', id: 'current' } as const;

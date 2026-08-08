/**
 * Noorani Cargo | Unified Firebase Configuration
 * Project: noorani-cargo-2005
 * Version: 2026-08-08 (Verified Console Config)
 */

export const firebaseConfig = {
  apiKey: "AIzaSyCL44ln9vmb0KNR2vtwAFBL5Ix_ukMDYF8",
  authDomain: "noorani-cargo-2005.firebaseapp.com",
  projectId: "noorani-cargo-2005",
  storageBucket: "noorani-cargo-2005.firebasestorage.app",
  messagingSenderId: "280080636182",
  appId: "1:280080636182:web:4ba9c12acfb8da668b1837",
  measurementId: "G-BL48KDSM4Z"
};

const isLocalHost = typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

export const useEmulators = isLocalHost &&
  new URLSearchParams(window.location.search).get('emulator') === '1';

import ReactGA from 'react-ga4';

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

let initialized = false;

// Call this once when the app boots
export const initGA = () => {
  if (initialized || !MEASUREMENT_ID) return;
  ReactGA.initialize(MEASUREMENT_ID);
  initialized = true;
};

// Call this on every route change
export const trackPageView = (path) => {
  if (!initialized) return;
  ReactGA.send({ hitType: 'pageview', page: path });
};

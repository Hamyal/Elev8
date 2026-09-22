const APPLICATION_STORAGE_PREFIX = "elev8-application-";

export const APPLICATION_ATTEMPT_KEY = `${APPLICATION_STORAGE_PREFIX}attempt-id`;
export const APPLICATION_DISQUALIFICATION_KEY = `${APPLICATION_STORAGE_PREFIX}disqualification`;
export const APPLICATION_DRAFT_KEY = `${APPLICATION_STORAGE_PREFIX}draft`;

export function clearApplicantApplicationState() {
  if (typeof window === "undefined") return;

  for (const storage of [window.localStorage, window.sessionStorage]) {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(APPLICATION_STORAGE_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  }

  // Remove the former session-wide latch created by earlier prototypes.
  window.sessionStorage.removeItem("elev8-apply-disqualified");
}

export function createApplicationAttempt() {
  clearApplicantApplicationState();
  const attemptId = window.crypto.randomUUID();
  window.sessionStorage.setItem(APPLICATION_ATTEMPT_KEY, attemptId);
  return attemptId;
}

export function getOrCreateApplicationAttempt() {
  const existing = window.sessionStorage.getItem(APPLICATION_ATTEMPT_KEY);
  return existing || createApplicationAttempt();
}
import AsyncStorage from "@react-native-async-storage/async-storage";

import { buildStoredStateFromImport } from "./storageImport";
import { STORAGE_KEY, type StoredState } from "./types";

const CORRUPT_STATE_RECOVERY_KEY = "lifeRpg:recovery:v1";

type StoredStateTransaction<T> = {
  state: StoredState;
  result: T;
  additionalEntries?: readonly (readonly [string, string])[];
};

let storageQueue: Promise<void> = Promise.resolve();

function runWithStorageLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = storageQueue.then(operation, operation);
  storageQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

async function readStoredStateUnsafe(): Promise<StoredState> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return buildStoredStateFromImport({});

  try {
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    return buildStoredStateFromImport(parsed);
  } catch {
    const existingRecovery = await AsyncStorage.getItem(CORRUPT_STATE_RECOVERY_KEY);
    if (!existingRecovery) {
      await AsyncStorage.setItem(CORRUPT_STATE_RECOVERY_KEY, raw);
    }
    return buildStoredStateFromImport({});
  }
}

export function readStoredState(): Promise<StoredState> {
  return runWithStorageLock(readStoredStateUnsafe);
}

export function transactStoredState<T>(
  operation: (current: StoredState) => Promise<StoredStateTransaction<T>> | StoredStateTransaction<T>
): Promise<T> {
  return runWithStorageLock(async () => {
    const current = await readStoredStateUnsafe();
    const transaction = await operation(current);
    const entries: [string, string][] = [
      [STORAGE_KEY, JSON.stringify(transaction.state)],
      ...(transaction.additionalEntries?.map(([key, value]) => [key, value] as [string, string]) ?? []),
    ];

    await AsyncStorage.multiSet(entries);
    return transaction.result;
  });
}

export function updateStoredState(
  updater: (current: StoredState) => StoredState
): Promise<StoredState> {
  return transactStoredState((current) => {
    const next = updater(current);
    return { state: next, result: next };
  });
}

export function replaceStoredState(state: StoredState): Promise<StoredState> {
  return runWithStorageLock(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  });
}

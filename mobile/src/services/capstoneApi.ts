import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { supabase } from './supabaseClient';

const pending = new Map<string, Promise<string>>();
const storagePrefix = 'capstone:request:';
const domainMessages: Record<string, string> = {
  AUTH_REQUIRED: '로그인이 필요합니다.', ACCOUNT_RESTRICTED: '계정 또는 학교 인증 상태를 확인해 주세요.',
  REQUEST_ID_REQUIRED: '요청을 다시 시도해 주세요.', REQUEST_IN_PROGRESS: '이전 요청을 처리하고 있습니다. 잠시 후 다시 확인해 주세요.',
  REQUEST_ALREADY_PROCESSED: '이 요청 ID가 다른 내용에 사용됐습니다.',
  ROOM_NOT_FOUND: '방을 찾을 수 없습니다.', ROOM_NOT_OPEN: '모집이 끝난 방입니다.', ROOM_FULL: '방 인원이 가득 찼습니다.',
  USER_NOT_MEMBER: '방 참여자만 할 수 있는 작업입니다.',
  ROOM_NOT_READY: '아직 모든 참여자의 준비·탑승·확인이 끝나지 않았습니다.',
  INSUFFICIENT_CREDIT: '사용 가능한 TEST 크레딧이 부족합니다.',
  ALREADY_JOINED: '이미 참여한 방입니다.', ALREADY_READY: '이미 준비를 완료했습니다.', ALREADY_RESERVED: '이미 이 방에 예치된 크레딧이 있습니다.',
  HOST_REQUIRED: '방장만 할 수 있는 작업입니다.',
  USER_NOT_MEMBER_OR_ALREADY_BOARDED: '참여자가 아니거나 이미 탑승 확인을 완료했습니다.',
  USER_NOT_MEMBER_OR_ALREADY_CONFIRMED: '참여자가 아니거나 이미 정산 확인을 완료했습니다.',
  USER_NOT_MEMBER_OR_ALREADY_REPORTED: '참여자가 아니거나 이미 미탑승 처리를 완료했습니다.',
  HOST_NOT_BOARDED: '방장의 탑승 확인이 필요합니다.',
  FARE_EXCEEDS_RESERVED_CREDIT: '분담금이 예치 크레딧보다 커서 정산할 수 없습니다.',
  INVALID_STATE_TRANSITION: '현재 상태에서는 이 작업을 할 수 없습니다.',
  SETTLEMENT_ALREADY_APPLIED: '이미 완료된 정산입니다.',
  SETTLEMENT_ITEM_MISMATCH: '정산 금액을 다시 계산해야 합니다.',
};

function client() {
  if (!supabase) throw new Error('Supabase 환경변수가 설정되지 않았습니다.');
  return supabase;
}

async function requestKey(operation: string, payload: Record<string, unknown>) {
  const fingerprint = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(payload),
  );
  return storagePrefix + operation + ':' + fingerprint;
}

async function getRequestId(key: string) {
  let task = pending.get(key);
  if (!task) {
    task = (async () => {
      const saved = await AsyncStorage.getItem(key);
      if (saved) return saved;
      const id = Crypto.randomUUID();
      await AsyncStorage.setItem(key, id);
      return id;
    })();
    pending.set(key, task);
  }
  return task;
}

// Keep an uncertain request ID across network errors and app restarts. The DB
// compares the full payload, and returns the original response on replay.
export async function mutate<T extends Record<string, unknown>>(
  operation: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const key = await requestKey(operation, payload);
  const requestId = await getRequestId(key);
  const { data, error } = await client().rpc(operation, { ...payload, p_request_id: requestId });
  if (error) {
    const code = Object.keys(domainMessages).find((candidate) => error.message.includes(candidate));
    throw new Error(code ? domainMessages[code] : error.message);
  }
  await AsyncStorage.removeItem(key);
  pending.delete(key);
  return data as T;
}

export async function readCreditSummary() {
  const { data, error } = await client().rpc('get_my_credit_summary');
  if (error) throw new Error(error.message);
  return data as { available_credit: number; held_credit: number; total_credit: number };
}

export { client as requireSupabase };

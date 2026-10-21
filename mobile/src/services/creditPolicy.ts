// Matches private.reserve_amount in 202610140008_room_credit_rpcs.sql.
export const MAX_SAFE_FARE = Number.MAX_SAFE_INTEGER;

export function isValidEstimatedFare(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export type FareParseResult =
  | { value: number; error: null }
  | { value: null; error: string };

export function parseFareInput(input: string): FareParseResult {
  if (!input) return { value: null, error: '예상 택시 요금을 입력해 주세요.' };
  if (!/^(?:[0-9]+|[1-9][0-9]{0,2}(?:,[0-9]{3})+)$/.test(input)) {
    return { value: null, error: '양의 정수를 입력해 주세요. 쉼표는 세 자리마다 넣을 수 있어요.' };
  }
  const integer = BigInt(input.replace(/,/g, ''));
  if (integer === 0n) return { value: null, error: '예상 택시 요금은 0보다 커야 해요.' };
  if (integer > BigInt(MAX_SAFE_FARE)) {
    return { value: null, error: `정확하게 처리할 수 있는 최대 금액은 ${MAX_SAFE_FARE.toLocaleString('ko-KR')}원이에요.` };
  }
  return { value: Number(integer), error: null };
}

export function calculateReserveAmount(estimatedFare: number, maxMembers: number): number {
  if (!isValidEstimatedFare(estimatedFare) || !Number.isInteger(maxMembers)
    || maxMembers < 2 || maxMembers > 4) {
    throw new Error('예상 요금과 인원을 확인해 주세요.');
  }
  const divisor = BigInt(maxMembers) * 1000n;
  const roundedUp = ((BigInt(estimatedFare) + divisor - 1n) / divisor) * 1000n;
  return Number(roundedUp < 5000n ? 5000n : roundedUp);
}

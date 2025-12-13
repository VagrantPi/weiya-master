// IOTA 單位換算工具：UI 以「IOTA」為主，鏈上以 nano IOTA（10^(-9)）為單位。

export const IOTA_DECIMALS = 9n;
export const IOTA_BASE = 10n ** IOTA_DECIMALS;

// 將「整數 IOTA」轉成「鏈上最小單位」（u64）
export const toBaseUnits = (amountIota: bigint): bigint => {
  if (amountIota < 0n) {
    throw new Error('IOTA 金額不可為負數');
  }
  return amountIota * IOTA_BASE;
};

// 將「鏈上最小單位」轉回「整數 IOTA」（捨去小數）
export const fromBaseUnits = (amountBase: bigint): bigint => {
  if (amountBase <= 0n) {
    return 0n;
  }
  return amountBase / IOTA_BASE;
};

// 以字串呈現「整數 IOTA」
export const formatIota = (amountBase: bigint): string => {
  return fromBaseUnits(amountBase).toString();
};

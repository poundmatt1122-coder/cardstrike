/** Platform fee calculator for member-to-member trades. */

export function calculateTradeFee(cardValue: number): number {
  if (cardValue < 50) return cardValue * 0.03;
  if (cardValue < 500) return cardValue * 0.025;
  return cardValue * 0.02;
}

export function splitFee(totalFee: number) {
  return {
    fromUser: totalFee / 2,
    toUser: totalFee / 2,
  };
}

/** Full fee breakdown for displaying in the offer modal. */
export function tradeFeeSummary(fromCardValue: number, toCardValue: number) {
  const feeFrom = calculateTradeFee(fromCardValue);
  const feeTo = calculateTradeFee(toCardValue);
  const total = feeFrom + feeTo;
  const split = splitFee(total);
  return {
    feeOnOfferedCard: feeFrom,
    feeOnListedCard: feeTo,
    totalFee: total,
    eachPays: split.fromUser,
  };
}

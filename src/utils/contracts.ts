export function getContractConfirmationCopy(questTitle: string): string {
  return `“${questTitle}” will become an optional must-do. If it is still open at midnight, the day is labeled Contract Broken and your contract streak resets. Its normal Discipline Rating scoring does not change, and you can remove the contract before midnight.`;
}

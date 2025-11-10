import type { TournamentOutput, RelatedTournament } from "./types";


export function removeDuplicates(tournaments: TournamentOutput[]): TournamentOutput[] {
  const seen: Record<string, number> = {};
  const relatedTournaments: Record<string, RelatedTournament[]> = {};

  const result = tournaments
    .filter(tournament => {
      if (!tournament.round || !tournament.event_id) return true;
      const handle = tournament.title + ' - ' + tournament.dates.startTournament;
      if (seen[handle]) {
        const data: RelatedTournament = { id: tournament.event_id, round: tournament.round.trim() };
        const key = String(seen[handle]);
        relatedTournaments[key]?.length ? relatedTournaments[key].push(data) : (relatedTournaments[key] = [data]);
        return false;
      } else {
        seen[handle] = tournament.event_id;
        return true;
      }
    })
    .map(tournament => {
      const key = String(tournament.event_id);
      if (relatedTournaments[key]) {
        tournament.relatedTournaments = relatedTournaments[key];
      }
      return tournament;
    });

  return result;
}

export function getCell(
  element: cheerio.Cheerio,
  number = false
): string | number {
  const text = element.text().trim();

  if (number) {
    const num = parseInt(text.replace(/\D/g, ""), 10);
    return isNaN(num) ? 0 : num;
  }

  return text;
}

export function removeDuplicates(tournaments) {
  const seen = {};
  const relatedTournaments = {};

  const result = tournaments.filter(tournament => {
    const handle = tournament.title + ' - ' + tournament.dates.startTournament;
    if (seen[handle]) {
      const data = { id: tournament.id, round: tournament.round.trim() };
      relatedTournaments[seen[handle]]?.length ? relatedTournaments[seen[handle]].push(data) : relatedTournaments[seen[handle]] = [data];
      return false;
    } else {
      seen[handle] = tournament.id;
      return tournament;
    }
  }).map(tournament => {
    if (relatedTournaments[tournament.id]) {
      tournament.relatedTournaments = relatedTournaments[tournament.id];
    }
    return tournament;
  });

  return result;
}

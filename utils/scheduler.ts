
import { Match, Team, TeamStats, MatchScore, PlayerStats, Streak, PairStats } from '../types';

// Helper to shuffle array
const shuffle = <T>(array: T[]): T[] => {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
};

export const generateSchedule = (teams: Team[], doubleRound: boolean, mode: 'SINGLES' | 'DOUBLES' | 'AMERICANO'): Match[] => {
  if (mode === 'AMERICANO') {
    return generateAmericanoSchedule(teams);
  }

  const matches: Match[] = [];
  const n = teams.length;
  if (n < 2) return [];

  // Round Robin Algorithm (Berger Tables)
  const scheduleTeams = [...teams];
  if (n % 2 !== 0) {
    scheduleTeams.push({ id: 'BYE', name: 'Riposo', players: [] });
  }

  const numTeams = scheduleTeams.length;
  const numRounds = numTeams - 1;
  const half = numTeams / 2;

  const teamIds = scheduleTeams.map(t => t.id);

  // First Leg (Andata)
  for (let round = 0; round < numRounds; round++) {
    for (let i = 0; i < half; i++) {
      const t1 = teamIds[i];
      const t2 = teamIds[numTeams - 1 - i];

      if (t1 !== 'BYE' && t2 !== 'BYE') {
        matches.push({
          id: `match-${round}-${i}`,
          teamAId: t1,
          teamBId: t2,
          round: round + 1,
          score: null,
          played: false,
        });
      }
    }
    // Rotate array
    teamIds.splice(1, 0, teamIds.pop()!);
  }

  // Second Leg (Ritorno)
  if (doubleRound) {
    const firstLegCount = matches.length;
    for (let i = 0; i < firstLegCount; i++) {
      const original = matches[i];
      matches.push({
        id: `match-return-${i}`,
        teamAId: original.teamBId,
        teamBId: original.teamAId,
        round: original.round + numRounds,
        score: null,
        played: false,
      });
    }
  }

  return matches;
};

const generateAmericanoSchedule = (participants: Team[]): Match[] => {
    // In Americano, 'participants' are individuals stored as teams.
    // We need multiples of 4 for perfect rounds.
    const players = [...participants];
    const matches: Match[] = [];
    
    // Add ghosts to make multiple of 4
    const remainder = players.length % 4;
    if (remainder !== 0) {
        const needed = 4 - remainder;
        for (let i = 0; i < needed; i++) {
            players.push({ id: `GHOST-${i}`, name: 'Riposo', players: [] });
        }
    }

    const totalPlayers = players.length;
    // We create rounds. For a simple Americano, we can do 3 rounds per group configuration, 
    // then shuffle and do it again. Let's do 6 rounds total (2 shuffles) to ensure good mixing.
    
    // Logic: Chunk into groups of 4. 
    // Within a group of 4 (A, B, C, D):
    // R1: (A,B) vs (C,D)
    // R2: (A,C) vs (B,D)
    // R3: (A,D) vs (B,C)
    
    const roundsToGenerate = 2; // Sets of mixing (each set is 3 games) -> Total 6 matches per player roughly

    let matchCount = 0;

    for (let mix = 0; mix < roundsToGenerate; mix++) {
        // Shuffle for this mixing block
        const currentPlayers = shuffle([...players]);
        
        // Process in chunks of 4
        for (let i = 0; i < totalPlayers; i += 4) {
            const group = currentPlayers.slice(i, i + 4);
            const p1 = group[0];
            const p2 = group[1];
            const p3 = group[2];
            const p4 = group[3];

            const isGhost = (id: string) => id.startsWith('GHOST');
            const hasGhost = (ids: string[]) => ids.some(id => isGhost(id));

            // Round 1 of this block: (0,1) vs (2,3)
            if (!hasGhost([p1.id, p2.id, p3.id, p4.id])) {
                matches.push({
                    id: `am-mix${mix}-g${i}-r1`,
                    teamAId: 'mix', // Placeholder
                    teamBId: 'mix', // Placeholder
                    playersAIds: [p1.id, p2.id],
                    playersBIds: [p3.id, p4.id],
                    round: (mix * 3) + 1,
                    score: null,
                    played: false
                });
            }

            // Round 2 of this block: (0,2) vs (1,3)
            if (!hasGhost([p1.id, p3.id, p2.id, p4.id])) {
                 matches.push({
                    id: `am-mix${mix}-g${i}-r2`,
                    teamAId: 'mix', 
                    teamBId: 'mix',
                    playersAIds: [p1.id, p3.id],
                    playersBIds: [p2.id, p4.id],
                    round: (mix * 3) + 2,
                    score: null,
                    played: false
                });
            }

            // Round 3 of this block: (0,3) vs (1,2)
            if (!hasGhost([p1.id, p4.id, p2.id, p3.id])) {
                matches.push({
                    id: `am-mix${mix}-g${i}-r3`,
                    teamAId: 'mix', 
                    teamBId: 'mix',
                    playersAIds: [p1.id, p4.id],
                    playersBIds: [p2.id, p3.id],
                    round: (mix * 3) + 3,
                    score: null,
                    played: false
                });
            }
        }
    }

    return matches.sort((a, b) => a.round - b.round);
};

export const calculateStats = (teams: Team[], matches: Match[], mode: 'SINGLES' | 'DOUBLES' | 'AMERICANO'): TeamStats[] => {
  const stats: Record<string, TeamStats> = {};

  // Initialize
  teams.forEach(t => {
    stats[t.id] = {
      teamId: t.id,
      played: 0,
      won: 0,
      lost: 0,
      points: 0,
      setsWon: 0,
      setsLost: 0,
      gamesWon: 0,
      gamesLost: 0,
      winRate: 0
    };
  });

  matches.forEach(m => {
    if (!m.played || !m.score) return;

    // Identify participants
    let sideAIds: string[] = [];
    let sideBIds: string[] = [];

    if (mode === 'AMERICANO') {
        if (!m.playersAIds || !m.playersBIds) return;
        sideAIds = m.playersAIds;
        sideBIds = m.playersBIds;
    } else {
        if (m.teamAId === 'BYE' || m.teamBId === 'BYE') return;
        sideAIds = [m.teamAId];
        sideBIds = [m.teamBId];
    }

    // Safety: ensure all IDs exist in stats
    const allIds = [...sideAIds, ...sideBIds];
    if (allIds.some(id => !stats[id])) return;

    let setsA = 0;
    let setsB = 0;
    let gamesA = 0;
    let gamesB = 0;

    // Score Calculation
    gamesA += m.score.set1.a;
    gamesB += m.score.set1.b;
    if (m.score.set1.a > m.score.set1.b) setsA++; else if (m.score.set1.b > m.score.set1.a) setsB++;

    gamesA += m.score.set2.a;
    gamesB += m.score.set2.b;
    if (m.score.set2.a > m.score.set2.b) setsA++; else if (m.score.set2.b > m.score.set2.a) setsB++;

    if (m.score.set3) {
      gamesA += m.score.set3.a;
      gamesB += m.score.set3.b;
      if (m.score.set3.a > m.score.set3.b) setsA++; else if (m.score.set3.b > m.score.set3.a) setsB++;
    }

    const sideAWon = setsA > setsB;

    // Update Side A
    sideAIds.forEach(id => {
        stats[id].played++;
        stats[id].setsWon += setsA;
        stats[id].setsLost += setsB;
        stats[id].gamesWon += gamesA;
        stats[id].gamesLost += gamesB;
        if (sideAWon) {
            stats[id].won++;
            stats[id].points += 3;
        } else {
            stats[id].lost++;
        }
    });

    // Update Side B
    sideBIds.forEach(id => {
        stats[id].played++;
        stats[id].setsWon += setsB;
        stats[id].setsLost += setsA;
        stats[id].gamesWon += gamesB;
        stats[id].gamesLost += gamesA;
        if (!sideAWon) {
            stats[id].won++;
            stats[id].points += 3;
        } else {
            stats[id].lost++;
        }
    });
  });

  // Calculate Win Rate
  Object.values(stats).forEach(s => {
      s.winRate = s.played > 0 ? (s.won / s.played) * 100 : 0;
  });

  return Object.values(stats).sort((a, b) => {
    // For Americano, Win Rate might be more important if matches played differ (due to BYEs)
    // But points is standard. We asked for "proporzionato alle partite".
    // Let's use Points Average as primary tie breaker if played differs significantly, otherwise Points.
    
    if (mode === 'AMERICANO') {
        const ratioA = a.played > 0 ? a.points / a.played : 0;
        const ratioB = b.played > 0 ? b.points / b.played : 0;
        if (Math.abs(ratioA - ratioB) > 0.01) return ratioB - ratioA;
    }

    if (b.points !== a.points) return b.points - a.points; 
    const gameDiffA = a.gamesWon - a.gamesLost;
    const gameDiffB = b.gamesWon - b.gamesLost;
    return gameDiffB - gameDiffA; 
  });
};

export const calculatePlayerRankings = (teams: Team[], matches: Match[]): PlayerStats[] => {
    const stats: Record<string, PlayerStats> = {};

    // Helper to init player
    const initPlayer = (name: string) => {
        if (!stats[name]) {
            stats[name] = {
                name,
                played: 0,
                won: 0,
                lost: 0,
                setsWon: 0,
                setsLost: 0,
                gamesWon: 0,
                gamesLost: 0,
                winRate: 0,
                avgSetDiff: 0,
                avgGameDiff: 0
            };
        }
    };

    // Initialize all players found in teams
    teams.forEach(t => {
        if (t.players && t.players.length > 0) {
            t.players.forEach(pName => initPlayer(pName));
        } else {
            // Fallback for Americano where team name IS player name or simple teams
            initPlayer(t.name);
        }
    });

    matches.forEach(m => {
        if (!m.played || !m.score) return;

        let playersASide: string[] = [];
        let playersBSide: string[] = [];

        // Determine players involved
        if (m.playersAIds && m.playersBIds) {
            // Americano mode (IDs match Team IDs which are basically Player IDs)
            const getNames = (ids: string[]) => ids.map(id => teams.find(t => t.id === id)?.name || id);
            playersASide = getNames(m.playersAIds);
            playersBSide = getNames(m.playersBIds);
        } else {
            // Team mode
            const teamA = teams.find(t => t.id === m.teamAId);
            const teamB = teams.find(t => t.id === m.teamBId);
            if (!teamA || !teamB || teamA.id === 'BYE' || teamB.id === 'BYE') return;

            // If team has explicit players list, use it. Otherwise use team name as player name
            playersASide = teamA.players.length > 0 ? teamA.players : [teamA.name];
            playersBSide = teamB.players.length > 0 ? teamB.players : [teamB.name];
        }

        // Initialize if not exists (dynamic handling)
        [...playersASide, ...playersBSide].forEach(p => initPlayer(p));

        // Calculate Match Score
        let setsA = 0;
        let setsB = 0;
        let gamesA = 0;
        let gamesB = 0;

        gamesA += m.score.set1.a;
        gamesB += m.score.set1.b;
        if (m.score.set1.a > m.score.set1.b) setsA++; else if (m.score.set1.b > m.score.set1.a) setsB++;

        gamesA += m.score.set2.a;
        gamesB += m.score.set2.b;
        if (m.score.set2.a > m.score.set2.b) setsA++; else if (m.score.set2.b > m.score.set2.a) setsB++;

        if (m.score.set3) {
            gamesA += m.score.set3.a;
            gamesB += m.score.set3.b;
            if (m.score.set3.a > m.score.set3.b) setsA++; else if (m.score.set3.b > m.score.set3.a) setsB++;
        }

        const sideAWon = setsA > setsB;

        // Update Stats A
        playersASide.forEach(name => {
            const s = stats[name];
            s.played++;
            s.setsWon += setsA;
            s.setsLost += setsB;
            s.gamesWon += gamesA;
            s.gamesLost += gamesB;
            if (sideAWon) s.won++; else s.lost++;
        });

        // Update Stats B
        playersBSide.forEach(name => {
            const s = stats[name];
            s.played++;
            s.setsWon += setsB;
            s.setsLost += setsA;
            s.gamesWon += gamesB;
            s.gamesLost += gamesA;
            if (!sideAWon) s.won++; else s.lost++;
        });
    });

    // Calculate Proportional Stats
    const result = Object.values(stats).map(s => {
        if (s.played > 0) {
            s.winRate = (s.won / s.played) * 100;
            s.avgSetDiff = (s.setsWon - s.setsLost) / s.played;
            s.avgGameDiff = (s.gamesWon - s.gamesLost) / s.played;
        }
        return s;
    });

    // Sort: 
    // 1. Win Rate %
    // 2. Avg Set Diff
    // 3. Avg Game Diff
    return result.sort((a, b) => {
        if (Math.abs(b.winRate - a.winRate) > 0.1) return b.winRate - a.winRate;
        if (Math.abs(b.avgSetDiff - a.avgSetDiff) > 0.01) return b.avgSetDiff - a.avgSetDiff;
        return b.avgGameDiff - a.avgGameDiff;
    });
};

export const calculateStreaks = (teams: Team[], matches: Match[]): Streak[] => {
    const streaks: Record<string, Streak> = {};

    // Helper to extract player names from team or americano id
    const getPlayers = (teamId: string, playerIds?: string[]) => {
        if (playerIds && playerIds.length > 0) {
            // Americano or Specific Lineup
            return playerIds.map(pid => teams.find(t => t.id === pid)?.name || pid);
        }
        const team = teams.find(t => t.id === teamId);
        if (!team || team.id === 'BYE') return [];
        return team.players.length > 0 ? team.players : [team.name];
    };

    // Sort matches chronologically
    const sorted = [...matches]
        .filter(m => m.played && m.score)
        .sort((a, b) => {
             const timeA = a.date ? new Date(a.date).getTime() : 0;
             const timeB = b.date ? new Date(b.date).getTime() : 0;
             if (timeA !== timeB) return timeA - timeB;
             return a.round - b.round;
        });

    // Initialize
    teams.forEach(t => {
        const names = t.players.length > 0 ? t.players : [t.name];
        names.forEach(n => {
            if (n !== 'Riposo') {
                streaks[n] = { name: n, current: 0, maxWin: 0, maxLoss: 0, recent: [] };
            }
        });
    });

    sorted.forEach(m => {
        const playersA = getPlayers(m.teamAId, m.playersAIds);
        const playersB = getPlayers(m.teamBId, m.playersBIds);

        let scoreA = 0;
        let scoreB = 0;
        if (m.score!.set1.a > m.score!.set1.b) scoreA++; else if (m.score!.set1.b > m.score!.set1.a) scoreB++;
        if (m.score!.set2.a > m.score!.set2.b) scoreA++; else if (m.score!.set2.b > m.score!.set2.a) scoreB++;
        if (m.score!.set3) {
            if (m.score!.set3.a > m.score!.set3.b) scoreA++; else if (m.score!.set3.b > m.score!.set3.a) scoreB++;
        }

        const winA = scoreA > scoreB;

        const updateStreak = (pName: string, won: boolean) => {
            if (!streaks[pName]) streaks[pName] = { name: pName, current: 0, maxWin: 0, maxLoss: 0, recent: [] };
            const s = streaks[pName];
            
            // Update Recent Form (Keep last 5)
            s.recent.push(won ? 'W' : 'L');
            if (s.recent.length > 5) s.recent.shift();

            // Update Current Streak
            if (won) {
                if (s.current < 0) s.current = 1;
                else s.current++;
                if (s.current > s.maxWin) s.maxWin = s.current;
            } else {
                if (s.current > 0) s.current = -1;
                else s.current--;
                if (Math.abs(s.current) > s.maxLoss) s.maxLoss = Math.abs(s.current);
            }
        };

        playersA.forEach(p => updateStreak(p, winA));
        playersB.forEach(p => updateStreak(p, !winA));
    });

    return Object.values(streaks).sort((a, b) => b.current - a.current);
};

export const calculatePairStats = (teams: Team[], matches: Match[]): PairStats[] => {
    const pairs: Record<string, PairStats> = {};

    matches.filter(m => m.played && m.score).forEach(m => {
        // Helper to process a side
        const processSide = (playerIds: string[] | undefined, teamId: string, isWinner: boolean) => {
            let names: string[] = [];
            if (playerIds && playerIds.length === 2) {
                // Explicit players (Americano or specific line up)
                names = playerIds.map(pid => teams.find(t => t.id === pid)?.name || pid);
            } else {
                // Team default
                const team = teams.find(t => t.id === teamId);
                if (team && team.players.length === 2) {
                    names = team.players;
                }
            }

            if (names.length === 2) {
                // Sort to ensure key consistency (A-B is same as B-A)
                names.sort();
                const key = `${names[0]} & ${names[1]}`;
                
                if (!pairs[key]) {
                    pairs[key] = { p1: names[0], p2: names[1], played: 0, won: 0, lost: 0, winRate: 0 };
                }
                
                pairs[key].played++;
                if (isWinner) pairs[key].won++;
                else pairs[key].lost++;
            }
        };

        let scoreA = 0;
        let scoreB = 0;
        if (m.score!.set1.a > m.score!.set1.b) scoreA++; else if (m.score!.set1.b > m.score!.set1.a) scoreB++;
        if (m.score!.set2.a > m.score!.set2.b) scoreA++; else if (m.score!.set2.b > m.score!.set2.a) scoreB++;
        if (m.score!.set3) {
             if (m.score!.set3.a > m.score!.set3.b) scoreA++; else if (m.score!.set3.b > m.score!.set3.a) scoreB++;
        }

        const winA = scoreA > scoreB;

        processSide(m.playersAIds, m.teamAId, winA);
        processSide(m.playersBIds, m.teamBId, !winA);
    });

    const result = Object.values(pairs).map(p => {
        p.winRate = (p.won / p.played) * 100;
        return p;
    });

    return result.sort((a, b) => b.winRate - a.winRate);
};

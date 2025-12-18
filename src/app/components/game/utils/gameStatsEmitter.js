import redisClient from '../../../../../redisClient.js';
import { loadCurrentGameData } from '../utils/loadCurrentGameData.js';


export async function emitPlayerStats(io) {
  const playersRaw = await redisClient.sMembers('players');
  const players = playersRaw
    .map(p => JSON.parse(p))
    .filter(p => p.role !== 'admin');
  const { playersPaidCount, game } = await loadCurrentGameData();

  io.emit('player-count', { current: players.length });
  io.emit('players-paid-count', {
    current: playersPaidCount,
    min: game.min_players
  });
}

export default { emitPlayerStats };

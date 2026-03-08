const activeChannels = new Map();
// key: channelId
// value: { 
//   channelNumber,
//   channelName,
//   recentTracks: [{
//     title,
//     artist,
//     timestamp
//   }],
//   activeUsers: Map()
//     key: userSessionKey,
//     value: {
//       startedAt,
//       stopAt,
//       lastScrobbled
//     }
// }

module.exports = { activeChannels };
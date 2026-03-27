const events = ["ClientReady", "MessagesUpsert", "UserJoin", "UserLeave", "Call"];

module.exports = Object.fromEntries(events.map(event => [event, event]));
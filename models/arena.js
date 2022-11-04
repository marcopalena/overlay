class Arena {
    constructor(id, isStreamed, isUsedInPools = false, isUsedInFinalPhase = false, usedUpToRound = 0, pools=[], rounds = [], round=0, match=0) {
        this.id = id;
        this.isStreamed = isStreamed;
        this.isUsedInPools = isUsedInPools;
        this.isUsedInFinalPhase = isUsedInFinalPhase;
        this.usedUpToRound = usedUpToRound;
        this.pools = pools;
        this.rounds = rounds;
        this.round = round;
        this.match = match;
    }
}
module.exports = Arena;

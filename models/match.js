class Match {
    constructor(id, isBye, isComplete, firstContender, secondContender, time, assaults, strategy, doppioVoid, consumed, arena) {
        this.isBye = isBye;
        this.isComplete = isComplete;
        this.id = id;
        this.firstContender = firstContender;
        this.secondContender = secondContender;
        this.time = time;
        this.assaults = assaults;
        this.consumed = consumed;
        this.strategy = strategy;
        this.doppioVoid = doppioVoid;
        this.arena = arena;
    }
}
module.exports = Match;

class MatchResult {
    constructor(contender, score, style, stylePartials, penalties = [0, 0, 0, 0]) {
        this.contender = contender;
        this.score = score;
        this.style = style;
        this.stylePartials = stylePartials;
        this.penalties = penalties;
    }
}
module.exports = MatchResult;

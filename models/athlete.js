class Athlete {
    constructor(name, academy, school, forms, battlename, pool, war=0, score=0, style=0.0, rank=-1, seed="") {
        this.name = name;
        this.academy = academy;
        this.school = school;
        this.battlename = battlename;
        this.n = forms.length;
        this.pool = pool;
        this.war = war;
        this.score = score;
        this.style = style;
        this.rank = rank;
        this.forms = forms;
        this.seed = seed;
    }
}
module.exports = Athlete;

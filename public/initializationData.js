var initialFinalPhaseSpecs = {
    "sheet" : "Final Phase",
    "finals" : {
        "contenders" : [
            {
                "name" : "AQ42",
                "score" : "AQ43",
                "style" : "AQ44"
            },
            {
                "name" : "AS42",
                "score" : "AS43",
                "style" : "AS44"
            }
        ],
    },
    "secondaryFinals" : {
        "contenders" : [
            {
                "name" : "AQ51",
                "score" : "AQ52",
                "style" : "AQ53"
            },
            {
                "name" : "AS51",
                "score" : "AS52",
                "style" : "AS53"
            }
        ]
    },
    "rounds" : [
        {
            "startRow" : 3,
            "seedCol" : "A",
            "nameCol" : "B",
            "scoreCol" : "C",
            "styleCol" : "D",
            "athleteSize" : 1,
            "arenas" : ["A", "B"],
            "layout" : [
                {
                    "level" : 0,
                    "blocks" : 4,
                    "spacing" : 3
                },
                {
                    "level" : 1,
                    "blocks" : 2,
                    "spacing" : 2
                },
                {
                    "level" : 2,
                    "blocks" : 4,
                    "spacing" : 1
                },
                {
                    "level" : 3,
                    "blocks" : 2,
                    "spacing" : 0
                }
            ]
        },
        {
            "startRow" : 3,
            "nameCol" : "I",
            "scoreCol" : "J",
            "styleCol" : "K",
            "athleteSize" : 2,
            "arenas" : ["A", "B"],
            "layout" : [
                {
                    "level" : 0,
                    "blocks" : 4,
                    "spacing" : 3
                },
                {
                    "level" : 1,
                    "blocks" : 2,
                    "spacing" : 2
                },
                {
                    "level" : 3,
                    "blocks" : 4,
                    "spacing" : 1
                }
            ]
        },
        {
            "startRow" : 5,
            "nameCol" : "P",
            "scoreCol" : "Q",
            "styleCol" : "R",
            "athleteSize" : 3,
            "arenas" : ["A"],
            "layout" : [
                {
                    "level" : 0,
                    "blocks" : 4,
                    "spacing" : 7
                },
                {
                    "level" : 1,
                    "blocks" : 2,
                    "spacing" : 6
                },
                {
                    "level" : 2,
                    "blocks" : 2,
                    "spacing" : 1
                }
            ]
        },
        {
            "startRow" : 10,
            "nameCol" : "Y",
            "scoreCol" : "Z",
            "styleCol" : "AA",
            "athleteSize" : 4,
            "arenas" : ["A"],
            "layout" : [
                {
                    "level" : 0,
                    "blocks" : 4,
                    "spacing" : 17
                },
                {
                    "level" : 1,
                    "blocks" : 2,
                    "spacing" : 2
                }
            ]
        },
        {
            "startRow" : 18,
            "nameCol" : "AH",
            "scoreCol" : "AI",
            "styleCol" : "AJ",
            "athleteSize" : 5,
            "arenas" : ["A"],
            "layout" : [
                {
                    "level" : 0,
                    "blocks" : 2,
                    "spacing" : 33
                },
                {
                    "level" : 1,
                    "blocks" : 2,
                    "spacing" : 11
                }
            ]
        },
        {
            "startRow" : 26,
            "nameCol" : "AQ",
            "athleteSize" : 5,
            "arenas" : ["A"],
            "layout" : [
                {
                    "level" : 0,
                    "blocks" : 2,
                    "spacing" : 49
                }
            ]
        }
    ]
}

var initialArenasSpec = {
    "arenas" : [
        {
            "name" : "A",
            "isStreamed" : true,
            // "isPools" : true,
            // "isLast32" : true,
            // "isLast16" : true,
            // "isLast8" : true,
            // "isLast4" : true,
            // "isSemi" : true,
            // "isFinal" : true,
            // "isSecondary" : true
        },
        {
            "name" : "B",
            "isStreamed" : true,
            // "isPools" : true,
            // "isLast32" : true,
            // "isLast16" : true,
            // "isLast8" : false,
            // "isLast4" : false,
            // "isSemi" : false,
            // "isFinal" : false,
            // "isSecondary" : false
        },
        {
            "name" : "C",
            "isStreamed" : false,
            // "isPools" : true,
            // "isLast32" : false,
            // "isLast16" : false,
            // "isLast8" : false,
            // "isLast4" : false,
            // "isSemi" : false,
            // "isFinal" : false,
            // "isSecondary" : false
        },
        {
            "name" : "D",
            "isStreamed" : false,
            // "isPools" : true,
            // "isLast32" : false,
            // "isLast16" : false,
            // "isLast8" : false,
            // "isLast4" : false,
            // "isSemi" : false,
            // "isFinal" : false,
            // "isSecondary" : false
        }
    ]
};


var initialPoolsSpecs = {
    "pools" : [
        {
            "id" : "A1",
            "sheetRankRange" : "Pools!A11:D18",
            "sheetNameCell" : "Pools!A9",
            "sheetMatchesRange" : "Results!A2:D84",
            "arena" : "A",
            "round" : 0
        },
        {
            "id" : "B1",
            "sheetRankRange" : "Pools!F11:I18",
            "sheetNameCell" : "Pools!F9",
            "sheetMatchesRange" : "Results!F2:I84",
            "arena" : "B",
            "round" : 0
        },
        {
            "id" : "C1",
            "sheetRankRange" : "Pools!K11:N18",
            "sheetNameCell" : "Pools!K9",
            "sheetMatchesRange" : "Results!K2:N84",
            "arena" : "C",
            "round" : 0
        },
        {
            "id" : "D1",
            "sheetRankRange" : "Pools!P11:S18",
            "sheetNameCell" : "Pools!P9",
            "sheetMatchesRange" : "Results!P2:S84",
            "arena" : "D",
            "round" : 0
        },
        {
            "id" : "A2",
            "sheetRankRange" : "Pools!A32:D39",
            "sheetNameCell" : "Pools!A30",
            "sheetMatchesRange" : "Results!U2:X84",
            "arena" : "A",
            "round" : 1
        },
        {
            "id" : "B2",
            "sheetRankRange" : "Pools!F32:I39",
            "sheetNameCell" : "Pools!F30",
            "sheetMatchesRange" : "Results!Z2:AC84",
            "arena" : "B",
            "round" : 1
        },
        {
            "id" : "C2",
            "sheetRankRange" : "Pools!K32:N39",
            "sheetNameCell" : "Pools!K30",
            "sheetMatchesRange" : "Results!AE2:AH84",
            "arena" : "C",
            "round" : 1
        },
        {
            "id" : "D2",
            "sheetRankRange" : "Pools!P32:S39",
            "sheetNameCell" : "Pools!P30",
            "sheetMatchesRange" : "Results!AJ2:AM84",
            "arena" : "D",
            "round" : 1
        }
    ]
};

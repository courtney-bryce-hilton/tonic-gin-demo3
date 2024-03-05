///////////////////////////
// 0. INITIALIZE JSPSYCH //
///////////////////////////


// initialise jsPsych
const jsPsych = initJsPsych({
    use_webaudio: true,
    on_data_update: () => {
        const content = document.getElementById('jspsych-content');
        content && content.focus();
    },
    on_trial_finish: () => {
        // Reset to top of page
        window.scrollTo(0, 0);
    },
    on_finish: () => {
        // ON FINISH: download the data to the local computer as a .csv file
        // Get the data
        const data = jsPsych.data.get().csv();

        // Convert data to blob
        const blob = new Blob([data], { type: 'text/csv' });

        // Create a URL for the blob
        const url = URL.createObjectURL(blob);

        // Create a link element to download the blob and append to page
        const link = document.createElement('a');
        link.href = url;

        // Downloaded .csv will be named like 'USERID_YYYY-MM-DD.csv'
        link.download = user.ID + "_" + getCurrentDate() + '.csv';
        document.body.appendChild(link);

        // Automatically 'click' the link to download data
        link.click();

        // Clean up by removing the link from page
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
});


///////////////////////////////
// 1. EXPERIMENT PARAMETERS //
///////////////////////////////


// const mobile = isMobile();
const mobile = false;

// number of trials to show each participant
const n_trials = 10;


///////////////////////////
// 2. SETTING UP STIMULI //
///////////////////////////


// load NHS discography song data
const songs = info.map((track_i) => {
    return ({
        track: track_i.track,
        stimulus: `stimuli/nhs_stimuli/TML-RAW-${track_i.track}.mp3`,
        data: match_track_to_data(track_i.track, track_data)
    })
});

const billboard_data = billboard_tracks.map((track, i) => {
    return ({
        track: `${i + 118 + 1}`,
        stimulus: track.stimulus,
        data: match_track_to_data(`${i + 118 + 1}`, track_data)
    })
});

// merge 
const song_data = [...songs, ...billboard_data];

// sample songs WITHOUT replacement
const song_list = jsPsych.randomization.sampleWithoutReplacement(song_data, n_trials);
// const song_list = jsPsych.randomization.sampleWithoutReplacement(song_data, 1);
// console.log(song_list);
// const song_list2 = new Array(24).fill().map(() => JSON.parse(JSON.stringify(song_list[0])));

// load billboard tracks


// load probe tones
const tones = Array(24).fill().map((_, idx) => ({ probe: `stimuli/probe_tones/probe_${idx.toString().padStart(2, '0')}.mp3` }));

// sample probe-tones, two for each 'trial', with restrictions such that within
// a trial, they can't be within 4 quarter tones
const probe_list = Array.from({ length: n_trials }).map(() => {
    // choose first index (between 0 and 23)
    const first = Math.floor(Math.random() * 24);

    // calculate remaining indexes, removing those within 4 quarter tones
    const allIdx = Array.from({ length: 24 }, (_, index) => index);
    let exclusions = calculateExclusions(first, 4, 24);
    let remainingIdx = allIdx.filter(idx => !exclusions.includes(idx));

    // sample second index from remaining indexes
    const second = remainingIdx[ Math.floor(Math.random() * remainingIdx.length) ];

    // calculate restrictions on second probe
    exclusions = calculateExclusions(second, 4, 24);
    remainingIdx = remainingIdx.filter(idx => !exclusions.includes(idx));

    // sample third index from remaining indexes
    const third = remainingIdx[ Math.floor(Math.random() * remainingIdx.length) ];
    
    // return probes corresponding to these indexes
    return [tones[first], tones[second], tones[third]];
});

console.log(probe_list);

// combine songs and probes in `trial_list`
const trial_list = song_list.map((song, index) => {
    song.probe1 = probe_list[index][0].probe;
    song.probe2 = probe_list[index][1].probe;
    song.probe3 = probe_list[index][2].probe;
    return song 
});

// const trial_list = song_list2.map((song, index) => {
//     song.probe = probe_list[index].probe;
//     return song
// });


// const trial_list2 = jsPsych.randomization.sampleWithoutReplacement(trial_list, 1);

console.log(trial_list);

// assemble list of audio files for preloading
let audioPreload = song_list.map((song) => { return (song.stimulus) });
audioPreload = audioPreload.concat([
    tones.map((obj) => {
        for (let key in obj) {
            return obj[key];
        }
    })
]);
audioPreload = audioPreload.flat();

// assemble list of images for preloading
// let imagePreload = song_list.map((song) => { return (song.image) });


//////////////////////////////////
// 3. DEFINING TIMELINE OBJECTS //
//////////////////////////////////


/* generic welcome */
const welcome = {
    type: jsPsychHtmlButtonResponse,
    stimulus: 'Tonic prototype demo 3',
    prompt1: ' ',
    prompt2: ' ',
    choices: ['Next']
};

const intro = {
    timeline: [
        {
            type: jsPsychInstructions,
            pages: [
                "How do you hear melodies?<br><br>Do different notes sound more or less tense?",
                "Listen to this melody and pay attention to the last note."
            ],
            button_label_next: "Continue",
            button_label_previous: "Back",
            show_clickable_nav: true
        },
        {
            type: jsPsychAudioKeyboardResponse,
            stimulus: 'stimuli/intro_melodies/intro_melody.mp3',
            choices: ['q'],
            prompt: '',
            trial_ends_after_audio: true
        },
        {
            type: jsPsychAudioKeyboardResponse,
            stimulus: 'stimuli/probe_tones/probe_12.mp3',
            choices: ['q'],
            prompt: 
            '<img src="stimuli/images/robot.png"></img>' +
            '<p>Listen to this probe...</p>',
            trial_ends_after_audio: true
        },
        {
            type: jsPsychHtmlButtonResponse,
            stimulus: [
                "Did that last note sound 'tense' or 'stable'?"
            ],
            choices: ['Tense', 'Stable', 'Not sure']
        },
        {
            type: jsPsychSurveyLikert,
            questions: [
                {
                    prompt: "How <b>tense</b> did that note sound?",
                    labels: [
                        "1<br>(not at all tense)",
                        "2",
                        "3",
                        "4",
                        "5<br>(very tense)"
                    ],
                    required: true
                }
            ],
            data: {
                trialName: 'introProbeRating'
            }
        },
        {
            type: jsPsychHtmlButtonResponse,
            stimulus: 
                "<div id='ratingPercent'></div>" +
                 '<canvas id="barChartCanvas" width="600" height="400"></canvas>',
            choices: ['Next'],
            on_load: () => {
                const user_response = jsPsych.data.getLastTrialData().select('response').values[0].Q0;
                renderChart([0,1,3,7,9], user_response);
            }
        },
        {
            type: jsPsychHtmlButtonResponse,
            stimulus: [
                "What if we changed that final note?"
            ],
            choices: ['Continue']
        },
        {
            type: jsPsychAudioKeyboardResponse,
            stimulus: 'stimuli/intro_melodies/intro_melody.mp3',
            choices: ['q'],
            prompt: '',
            trial_ends_after_audio: true
        },
        {
            type: jsPsychAudioKeyboardResponse,
            stimulus: 'stimuli/probe_tones/probe_06.mp3',
            choices: ['q'],
            prompt: 
            '<img src="stimuli/images/robot.png"></img>' +
            '<p>Listen to this probe...</p>',
            trial_ends_after_audio: true
        },
        {
            type: jsPsychHtmlButtonResponse,
            stimulus: [
                "Did that sound more or less tense than the previous example?"
            ],
            choices: ['More tense', 'Less tense', 'No difference']
        },
        {
            type: jsPsychSurveyLikert,
            questions: [
                {
                    prompt: "How <b>tense</b> did that note sound?",
                    labels: [
                        "1<br>(not at all tense)",
                        "2",
                        "3",
                        "4",
                        "5<br>(very tense)"
                    ],
                    required: true
                }
            ],
            data: {
                trialName: 'introProbeRating'
            }
        },
        {
            type: jsPsychHtmlButtonResponse,
            stimulus: 
                "<div id='ratingPercent'></div>" +
                 '<canvas id="barChartCanvas" width="600" height="400"></canvas>',
            choices: ['Next'],
            on_load: () => {
                const user_response = jsPsych.data.getLastTrialData().select('response').values[0].Q0;
                renderChart([1,4,7,8,6], user_response);
            }
        },
        {
            type: jsPsychHtmlButtonResponse,
            stimulus: [
                "And how about this note?"
            ],
            choices: ['Continue']
        },
        {
            type: jsPsychAudioKeyboardResponse,
            stimulus: 'stimuli/intro_melodies/intro_melody.mp3',
            choices: ['q'],
            prompt: '',
            trial_ends_after_audio: true
        },
        {
            type: jsPsychAudioKeyboardResponse,
            stimulus: 'stimuli/probe_tones/probe_00.mp3',
            choices: ['q'],
            prompt: 
            '<img src="stimuli/images/robot.png"></img>' +
            '<p>Listen to this probe...</p>',
            trial_ends_after_audio: true
        },
        {
            type: jsPsychSurveyLikert,
            questions: [
                {
                    prompt: "How <b>tense</b> did that note sound?",
                    labels: [
                        "1<br>(not at all tense)",
                        "2",
                        "3",
                        "4",
                        "5<br>(very tense)"
                    ],
                    required: true
                }
            ],
            data: {
                trialName: 'introProbeRating'
            }
        },
        {
            type: jsPsychHtmlButtonResponse,
            stimulus: 
                "<div id='ratingPercent'></div>" +
                 '<canvas id="barChartCanvas" width="600" height="400"></canvas>',
            choices: ['Next'],
            on_load: () => {
                const user_response = jsPsych.data.getLastTrialData().select('response').values[0].Q0;
                renderChart([9,7,3,1,0], user_response);
            }
        },
        {
            type: jsPsychHtmlButtonResponse,
            stimulus: [
                "And how about this note?"
            ],
            choices: ['Continue']
        },
        {
            type: jsPsychAudioKeyboardResponse,
            stimulus: 'stimuli/intro_melodies/intro_melody.mp3',
            choices: ['q'],
            prompt: '',
            trial_ends_after_audio: true
        },
        {
            type: jsPsychAudioKeyboardResponse,
            stimulus: 'stimuli/probe_tones/probe_08.mp3',
            choices: ['q'],
            prompt: 
            '<img src="stimuli/images/robot.png"></img>' +
            '<p>Listen to this probe...</p>',
            trial_ends_after_audio: true
        },
        {
            type: jsPsychSurveyLikert,
            questions: [
                {
                    prompt: "How <b>tense</b> did that note sound?",
                    labels: [
                        "1<br>(not at all tense)",
                        "2",
                        "3",
                        "4",
                        "5<br>(very tense)"
                    ],
                    required: true
                }
            ],
            data: {
                trialName: 'introProbeRating'
            }
        },
        {
            type: jsPsychHtmlButtonResponse,
            stimulus: 
                "<div id='ratingPercent'></div>" +
                 '<canvas id="barChartCanvas" width="600" height="400"></canvas>',
            choices: ['Next'],
            on_load: () => {
                const user_response = jsPsych.data.getLastTrialData().select('response').values[0].Q0;
                renderChart([9,7,3,1,0], user_response);
            }
        },
        {
            type: jsPsychHtmlButtonResponse,
            stimulus: [
                "In the rest of this study, you will be making ratings like this with <i>real</i> musical examples from around the world<br><br>" +
                "At the end, we will give you a score of how similar your musical intuitions are to those of other people.<br><br>" +
                "Have fun!" 
            ],
            choices: ['Continue']
        }
    ]
};

const tonic_intro_welcome = {
    type: jsPsychHtmlButtonResponse,
    stimulus: '<p align="left">' +
        "Before we get to the music, let's do a quick warm-up with a colour game." +
        '<br><br>' +
        "<b>1)</b> coloured squares flash up on the screen." +
        '<br><br>' +
        "<b>2)</b> a final 'probe' coloured square appears" +
        "<br><br>" +
        "<b>3)</b> you rate how well that colour fits in with the other colours." +
        "<br><br>" +
        "Colours that fit are ones that blend in well with the other colours." +
        '<br>' +
        "Colours that don't fit will stand out or contrast with the other colours." +
        '</p>' + 
        `<div><img src='stimuli/square_stim/intro_colour.png' width="60%"></img></div>` + 
        "<br><br>",
    prompt1: ' ',
    prompt2: ' ',
    choices: ['Next']
};

const tonic_main_welcome = {
    type: jsPsychHtmlButtonResponse,
    stimulus: '<p align="left">' +
        "Now you will do the same thing with music." +
        '<br><br>' +
        "<b>1)</b> you will hear a melody." +
        '<br><br>' +
        "<b>2)</b> then a 'probe' tone." +
        "<br><br>" +
        "<b>3)</b> you rate how well that tone fits with the melody." +
        "<br><br>" +
        "Tones that fit sound like they blend in with the other pitches in the melody." +
        '<br>' +
        "Tones that don't fit stand out from the other pitches in the melody" +
        "</p><br>",
    prompt1: ' ',
    prompt2: ' ',
    choices: ['Next']
};



const probe_task = {
    timeline: [
        {
            type: jsPsychAudioKeyboardResponse,
            stimulus: jsPsych.timelineVariable('stimulus'),
            choices: ['q'],
            prompt: '<p>Listen to this melody...</p>',
            // trial_duration: 10000,
            trial_ends_after_audio: true
        },
        {
            type: jsPsychAudioKeyboardResponse,
            stimulus: jsPsych.timelineVariable('probe1'),
            choices: ['q'],
            prompt: 
            '<img src="stimuli/images/robot.png"></img>' +
            '<p>Listen to this probe...</p>',
            trial_ends_after_audio: true
        },
        {
            type: jsPsychSurveyLikert,
            questions: [
                {
                    prompt: "How well does this pitch fit the song?",
                    labels: [
                        "1",
                        "2",
                        "3",
                        "4",
                        "5"
                    ],
                    required: true
                }
            ],
            data: {
                trialName: 'probeRating'
            },
            on_finish: (data) => {
                const similariy_score = calculate_similarity(
                    jsPsych.data.getLastTrialData().select('response').values[0].Q0 + 1, 
                    jsPsych.timelineVariable('data')
                );
                data.similarity = similariy_score;
            }
        },
        {
            type: jsPsychAudioKeyboardResponse,
            stimulus: jsPsych.timelineVariable('stimulus'),
            choices: ['q'],
            prompt: '<p>Listen to this melody...</p>',
            // trial_duration: 10000,
            trial_ends_after_audio: true
        },
        {
            type: jsPsychAudioKeyboardResponse,
            stimulus: jsPsych.timelineVariable('probe2'),
            choices: ['q'],
            prompt: 
            '<img src="stimuli/images/robot.png"></img>' +
            '<p>Listen to this probe...</p>',
            trial_ends_after_audio: true
        },
        // {
        //     type: jsPsychHtmlButtonResponse,
        //     stimulus: [
        //         "Did that sound more or less tense than the previous example?"
        //     ],
        //     choices: ['More tense', 'Less tense']
        // },
        {
            type: jsPsychSurveyLikert,
            questions: [
                {
                    prompt: "How well does this pitch fit the song?",
                    labels: [
                        "1",
                        "2",
                        "3",
                        "4",
                        "5"
                    ],
                    required: true
                }
            ],
            data: {
                trialName: 'probeRating'
            },
            on_finish: (data) => {
                const similariy_score = calculate_similarity(
                    jsPsych.data.getLastTrialData().select('response').values[0].Q0 + 1, 
                    jsPsych.timelineVariable('data')
                );
                data.similarity = similariy_score;
            }
        },
        {
            type: jsPsychAudioKeyboardResponse,
            stimulus: jsPsych.timelineVariable('stimulus'),
            choices: ['q'],
            prompt: '<p>Listen to this melody...</p>',
            // trial_duration: 10000,
            trial_ends_after_audio: true
        },
        {
            type: jsPsychAudioKeyboardResponse,
            stimulus: jsPsych.timelineVariable('probe3'),
            choices: ['q'],
            prompt: 
            '<img src="stimuli/images/robot.png"></img>' +
            '<p>Listen to this probe...</p>',
            trial_ends_after_audio: true
        },
        {
            type: jsPsychSurveyLikert,
            questions: [
                {
                    prompt: "How well does this pitch fit the song?",
                    labels: [
                        "1",
                        "2",
                        "3",
                        "4",
                        "5"
                    ],
                    required: true
                }
            ],
            data: {
                trialName: 'probeRating'
            },
            on_finish: (data) => {
                const similariy_score = calculate_similarity(
                    jsPsych.data.getLastTrialData().select('response').values[0].Q0 + 1, 
                    jsPsych.timelineVariable('data')
                );
                data.similarity = similariy_score;
            }
        },
        // {
        //     type: jsPsychSurveyRevision,
        //     questions: [
        //         {
        //             prompt: "How well does this pitch fit the song?",
        //             labels: [
        //                 "1",
        //                 "2",
        //                 "3",
        //                 "4",
        //                 "5"
        //             ],
        //             required: true
        //         }
        //     ],
        //     scale_width: 400,
        //     melody: jsPsych.timelineVariable('stimulus'),
        //     probe1: jsPsych.timelineVariable('probe1'),
        //     probe2: jsPsych.timelineVariable('probe2'),
        //     data: {
        //         trialName: 'probeRating'
        //     },
        //     likert_values: () => {
        //         return jsPsych.data.get().trials // gets all the data so far
        //         .filter(item => item.trialName === 'probeRating') // filters to just the 'probeRating' trials
        //         .map(item => item.response) // returns the 'response' values of those trials
        //         .slice(-2) // just keeps the last two of them
        //         .map(obj => obj ? Object.values(obj)[0] : null) // extracts out the response value from `{Q0: value}`
        //     }
        // },
        // {
        //     type: jsPsychHtmlButtonResponse,
        //     stimulus: 
        //         "<div id='ratingPercent'></div>" +
        //          '<canvas id="barChartCanvas" width="600" height="400"></canvas>',
        //     choices: ['Next'],
        //     on_load: () => {
        //         const user_response = jsPsych.data.getLastTrialData().select('response').values[0].Q0;
        //         renderChart(jsPsych.timelineVariable('data'), user_response);
        //     }
        // }
    ],
    timeline_variables: trial_list
}

const end_page = {
    type: jsPsychHtmlButtonResponse,
    stimulus: "<div id='finalScore'></div>",
    choices: ['End'],
    on_load: () => {
        const similarityValues = jsPsych.data.get().trials.map(obj => obj.similarity).filter(value => value !== undefined);
        let similarityPercent = calculateAverage(similarityValues);
        similarityPercent = Math.round(similarityPercent);
        const scoreText = `Overall, your ratings were ${similarityPercent}% similar to other players.`;
        document.getElementById('finalScore').innerHTML = scoreText;
    }
};


const preload_trial = {
    type: jsPsychPreload,
    audio: audioPreload,
    // images: imagePreload
}


////////////////////////////
// 4. ASSEMBLING TIMELINE //
////////////////////////////


const timeline = [
    welcome,
    preload_trial,
    intro,
    // intro_task,
    tonic_main_welcome,
    probe_task,
    end_page
];


///////////////////////
// 5. RUN EXPERIMENT //
///////////////////////


jsPsych.run(timeline);
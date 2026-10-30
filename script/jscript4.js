// =====================================================================
//  ОБЩИЕ НАСТРОЙКИ
// =====================================================================

const TICKS_PER_BAR = Tone.Transport.PPQ * 4; // 4/4

// Темп у каждой вкладки свой
const BPM = { happiness: 140, sadness: 72, anger: 150 };
Tone.Transport.bpm.value = BPM.happiness;

// Превращает список {note, dur} / {isRest, dur} в зацикленный Tone.Part.
// Время считается в тиках транспорта, а не в секундах, поэтому ритм
// не плывёт и не зависит от погрешностей округления.
function buildLoop(name, synth, steps) {
    const events = [];
    let ticks = 0;

    steps.forEach(step => {
        const d = Tone.Time(step.dur).toTicks();
        if (!step.isRest) {
            events.push({ time: ticks + 'i', note: step.note, dur: d + 'i' });
        }
        ticks += d;
    });

    const part = new Tone.Part((time, ev) => {
        synth.triggerAttackRelease(ev.note, ev.dur, time);
    }, events);

    part.loop = true;
    part.loopEnd = ticks + 'i';

    const bars = ticks / TICKS_PER_BAR;
    if (!Number.isInteger(bars)) {
        console.warn(`⚠️ ${name}: длина ${bars.toFixed(3)} такта — не целое число, мелодии разъедутся`);
    } else {
        console.log(`🔁 ${name}: ${bars} такт(а)`);
    }
    return part;
}

// Уровень 0..1 → децибелы (0 = тишина)
const toDb = level => level <= 0.001 ? -Infinity : Tone.gainToDb(level);

// У каждой эмоции свой «канал»: неактивные вкладки заглушены
// Общий выход: компрессор выравнивает громкость, лимитер не даёт звуку
// превысить максимум — без этого при нескольких слоях звук хрипит и «пердит»
const masterLimiter = new Tone.Limiter(-1).toDestination();
const masterComp = new Tone.Compressor({ threshold: -18, ratio: 3, attack: 0.01, release: 0.2 }).connect(masterLimiter);
Tone.Destination.volume.value = -3;

const buses = {
    happiness: new Tone.Gain(1).connect(masterComp),
    sadness:   new Tone.Gain(0).connect(masterComp),
    anger:     new Tone.Gain(0).connect(masterComp),
};

// =====================================================================
//  HAPPINESS  (фа мажор, 3 такта)
// =====================================================================
const happinessSynth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.1, decay: 0.1, sustain: 0.8, release: 1.0 }
});

const distEffect = new Tone.Distortion({ wet: 0, distortion: 1 });
const chorusEffect = new Tone.Phaser({ wet: 0, frequency: 0.5 });
const happinessDelay = new Tone.PingPongDelay({ delayTime: 0.15, wet: 0 });
const freeVerb = new Tone.Freeverb({ wet: 0, roomSize: 0.7 });

// Synth → Distortion → Phaser → Delay → Reverb → канал happiness
happinessSynth.chain(distEffect, chorusEffect, happinessDelay, freeVerb, buses.happiness);

// Ровно 3 такта. Ритм «3+3+2»: каждая группа — ровно полтакта,
// первая нота группы всегда на сильной доле
const happinessNotes = [
    // такт 1
    { note: "F4", dur: "8n." }, { note: "C5", dur: "8n." }, { note: "A4", dur: "8n" },
    { note: "F4", dur: "8n." }, { note: "C5", dur: "8n." }, { note: "A4", dur: "8n" },
    // такт 2
    { note: "F4", dur: "8n." }, { note: "G4", dur: "8n." }, { note: "A4", dur: "8n" },
    { note: "A4", dur: "2n" },
    // такт 3 — пауза, здесь отвечает inspiration
    { isRest: true, dur: "1n" },
];

const happinessPart = buildLoop('happiness', happinessSynth, happinessNotes);

// ---------- CALMNESS ----------
const calmSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.03, decay: 0.2, sustain: 0.7, release: 0.8 },
    volume: -Infinity // ручка сверху: тишина
});

const calmReverb = new Tone.Freeverb({ roomSize: 0.7, dampening: 2500, wet: 0.25 });
calmSynth.chain(calmReverb, buses.happiness);

// Опора снизу: одна длинная нота на такт, октавой ниже мелодии. 3 такта.
// C в третьем такте создаёт ожидание и тянет обратно к началу петли.
const calmNotes = [
    { note: "F3", dur: "1n" },
    { note: "A3", dur: "1n" },
    { note: "C4", dur: "1n" },
];

const calmPart = buildLoop('calmness', calmSynth, calmNotes);

// ---------- INSPIRATION ----------
const inspoSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 2.55, sustain: 0, release: 1 },
    volume: -Infinity
});
inspoSynth.detune.value = 4;

const bellFilter = new Tone.Filter({ type: 'highpass', frequency: 600, Q: 1 });
const inspoReverb = new Tone.Freeverb({ wet: 0.8, roomSize: 0.6 });

// Synth → Filter → Reverb → канал happiness
inspoSynth.chain(bellFilter, inspoReverb, buses.happiness);

// Ровно 3 такта. Отвечает только в паузах мелодии — диалог «вопрос — ответ»
const inspoNotes = [
    // такт 1 — молчит, мелодия занята
    { isRest: true, dur: "1n" },
    // такт 2 — вступает, пока happiness тянет A
    { isRest: true, dur: "2n" },
    { isRest: true, dur: "8n" },
    { note: "C6", dur: "8n" }, { note: "A5", dur: "8n" }, { note: "F5", dur: "8n" },
    // такт 3 — полный ответ, заканчивается «домой» на F
    { note: "A5", dur: "8n" }, { note: "C6", dur: "8n" },
    { note: "A5", dur: "8n" }, { note: "G5", dur: "8n" },
    { note: "F5", dur: "2n" },
];

const inspoPart = buildLoop('inspiration', inspoSynth, inspoNotes);

// ---------- GRATITUDE ----------
// Тёплое мягкое арпеджио по четвертям в середине диапазона.
// Только звуки аккорда F, каждый такт поднимается чуть выше — «благодарный вздох».
const gratSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.05, decay: 0.6, sustain: 0.3, release: 1.2 },
    volume: -Infinity
});
const gratReverb = new Tone.Freeverb({ wet: 0.4, roomSize: 0.75, dampening: 2000 });
gratSynth.chain(gratReverb, buses.happiness);

const gratNotes = [
    // такт 1
    { note: "A3", dur: "4n" }, { note: "C4", dur: "4n" }, { note: "F4", dur: "4n" }, { note: "C4", dur: "4n" },
    // такт 2
    { note: "C4", dur: "4n" }, { note: "F4", dur: "4n" }, { note: "A4", dur: "4n" }, { note: "F4", dur: "4n" },
    // такт 3 — идёт вверх вместе с ответом inspiration
    { note: "A3", dur: "4n" }, { note: "C4", dur: "4n" }, { note: "F4", dur: "4n" }, { note: "A4", dur: "4n" },
];

const gratPart = buildLoop('gratitude', gratSynth, gratNotes);

// =====================================================================
//  SADNESS  (ля минор, 4 такта: Am – F – Dm – E, медленно)
// =====================================================================
const sadSynth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.2, decay: 0.3, sustain: 0.6, release: 2.0 }
});

const sadDist = new Tone.Distortion({ wet: 0, distortion: 0.6 });
const sadChorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0 }).start();
const sadDelay = new Tone.FeedbackDelay({ delayTime: '4n', feedback: 0.4, wet: 0 });
const sadReverb = new Tone.Freeverb({ wet: 0, roomSize: 0.85, dampening: 2500 });

// Synth → Distortion → Chorus → Delay → Reverb → канал sadness
sadSynth.chain(sadDist, sadChorus, sadDelay, sadReverb, buses.sadness);

// Медленная мелодия, которая всё время спускается вниз
const sadNotes = [
    // такт 1 — Am
    { note: "E5", dur: "4n" }, { note: "D5", dur: "8n" }, { note: "C5", dur: "8n" },
    { note: "B4", dur: "4n" }, { note: "A4", dur: "4n" },
    // такт 2 — F
    { note: "C5", dur: "4n." }, { note: "B4", dur: "8n" }, { note: "A4", dur: "2n" },
    // такт 3 — Dm
    { note: "F4", dur: "4n" }, { note: "A4", dur: "4n" }, { note: "D5", dur: "4n." }, { note: "C5", dur: "8n" },
    // такт 4 — E, неразрешённо, тянет обратно к началу
    { note: "B4", dur: "2n" }, { note: "G#4", dur: "4n" }, { isRest: true, dur: "4n" },
];

const sadPart = buildLoop('sadness', sadSynth, sadNotes);

// ---------- LONELINESS ----------
// Редкие высокие «капли» с эхом — одинокий голос вдалеке
const lonelySynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 2, sustain: 0, release: 2 },
    volume: -Infinity
});
const lonelyDelay = new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.5, wet: 0.4 });
const lonelyReverb = new Tone.Freeverb({ wet: 0.7, roomSize: 0.9 });
lonelySynth.chain(lonelyDelay, lonelyReverb, buses.sadness);

const lonelyNotes = [
    { isRest: true, dur: "1n" },                                          // Am
    { isRest: true, dur: "2n" }, { note: "C6", dur: "4n" }, { note: "A5", dur: "4n" },  // F
    { isRest: true, dur: "1n" },                                          // Dm
    { isRest: true, dur: "2n" }, { note: "B5", dur: "4n" }, { note: "G#5", dur: "4n" }, // E
];

const lonelyPart = buildLoop('loneliness', lonelySynth, lonelyNotes);

// ---------- FATIGUE ----------
// Низкие пустые квинты с медленной атакой — тяжесть и усталость
const fatigueSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 1.0, decay: 0.5, sustain: 0.8, release: 2.0 }
});
fatigueSynth.volume.value = -Infinity;
const fatigueFilter = new Tone.Filter({ type: 'lowpass', frequency: 600 });
fatigueSynth.chain(fatigueFilter, buses.sadness);

const fatigueNotes = [
    { note: ["A2", "E3"], dur: "1n" },
    { note: ["F2", "C3"], dur: "1n" },
    { note: ["D2", "A2"], dur: "1n" },
    { note: ["E2", "B2"], dur: "1n" },
];

const fatiguePart = buildLoop('fatigue', fatigueSynth, fatigueNotes);

// ---------- REGRET ----------
// Подголосок в духе виолончели: половинные ноты, в конце разрешается вниз
const regretSynth = new Tone.Synth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.15, decay: 0.3, sustain: 0.7, release: 1.0 },
    volume: -Infinity
});
const regretFilter = new Tone.Filter({ type: 'lowpass', frequency: 1000 });
const regretReverb = new Tone.Freeverb({ wet: 0.3, roomSize: 0.7 });
regretSynth.chain(regretFilter, regretReverb, buses.sadness);

const regretNotes = [
    { note: "C4", dur: "2n" }, { note: "E4", dur: "2n" },  // Am
    { note: "C4", dur: "2n" }, { note: "A3", dur: "2n" },  // F
    { note: "D4", dur: "2n" }, { note: "F4", dur: "2n" },  // Dm
    { note: "E4", dur: "2n" }, { note: "D4", dur: "2n" },  // E7 → снова C4
];

const regretPart = buildLoop('regret', regretSynth, regretNotes);

// =====================================================================
//  ANGER  (ми фригийский, 2 такта, быстро)
// =====================================================================
const angerMaster = new Tone.Volume(0).connect(buses.anger); // ручка volume

const angerSynth = new Tone.Synth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.4, release: 0.1 },
    volume: -6
});

// ---------- RAGE ----------
// Дубль риффа с расстройкой: чем дальше ручка, тем громче и «грязнее»
const detuneSynth = new Tone.Synth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.4, release: 0.1 },
    volume: -Infinity
});

const angerDist = new Tone.Distortion({ wet: 0, distortion: 0.9 });
const angerPhaser = new Tone.Phaser({ wet: 0, frequency: 2, octaves: 3, baseFrequency: 400 });
const angerDelay = new Tone.PingPongDelay({ delayTime: '8n', feedback: 0.3, wet: 0 });
const angerReverb = new Tone.Freeverb({ wet: 0, roomSize: 0.5 });

// Рифф и его дубль → Distortion → Phaser → Delay → Reverb → громкость → канал anger
angerSynth.chain(angerDist, angerPhaser, angerDelay, angerReverb, angerMaster);
detuneSynth.connect(angerDist);

// Рубленый рифф на низкой E с «злым» полутоном F
const angerNotes = [
    // такт 1
    { note: "E3", dur: "8n" }, { note: "E3", dur: "16n" }, { note: "E3", dur: "16n" },
    { note: "F3", dur: "8n" }, { note: "E3", dur: "8n" },
    { note: "G3", dur: "8n" }, { note: "E3", dur: "8n" },
    { note: "F3", dur: "8n" }, { note: "E3", dur: "8n" },
    // такт 2
    { note: "E3", dur: "8n" }, { note: "E3", dur: "16n" }, { note: "E3", dur: "16n" },
    { note: "B3", dur: "8n" }, { note: "A3", dur: "8n" },
    { note: "G3", dur: "8n" }, { note: "F3", dur: "8n" },
    { note: "E3", dur: "4n" },
];

const angerPart = buildLoop('anger', angerSynth, angerNotes);
const detunePart = buildLoop('rage', detuneSynth, angerNotes);

// Бас восьмыми — идёт вместе с риффом
const bassSynth = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.005, decay: 0.15, sustain: 0.5, release: 0.05 },
    volume: -10
});
const bassFilter = new Tone.Filter({ type: 'lowpass', frequency: 400 });
bassSynth.chain(bassFilter, angerMaster);

const e8 = { note: "E2", dur: "8n" };
const bassNotes = [
    e8, e8, e8, e8, e8, e8, e8, e8,
    e8, e8, e8, e8,
    { note: "G2", dur: "8n" }, { note: "F2", dur: "8n" }, e8, e8,
];

const bassPart = buildLoop('anger bass', bassSynth, bassNotes);

// ---------- TENSION ----------
// Высокие тянущиеся ноты: B → C → B, «злой» полутон сверху держит напряжение
const tensionSynth = new Tone.Synth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.3, decay: 0.2, sustain: 0.8, release: 0.6 },
    volume: -Infinity
});
const tensionFilter = new Tone.Filter({ type: 'lowpass', frequency: 1500 });
const tensionReverb = new Tone.Freeverb({ wet: 0.3, roomSize: 0.6 });
tensionSynth.chain(tensionFilter, tensionReverb, angerMaster);

const tensionNotes = [
    { note: "B4", dur: "1n" },                              // такт 1
    { note: "C5", dur: "2n" }, { note: "B4", dur: "2n" },   // такт 2
];

const tensionPart = buildLoop('tension', tensionSynth, tensionNotes);

// ---------- FURY ----------
// Резкие высокие выкрики во второй половине каждого такта — отвечают риффу
const furySynth = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.5, release: 0.1 },
    volume: -Infinity
});
const furyDelay = new Tone.PingPongDelay({ delayTime: '16n', feedback: 0.25, wet: 0.25 });
furySynth.chain(furyDelay, angerMaster);

const furyNotes = [
    // такт 1
    { isRest: true, dur: "2n" },
    { note: "E5", dur: "16n" }, { note: "E5", dur: "16n" }, { note: "F5", dur: "8n" },
    { note: "E5", dur: "4n" },
    // такт 2
    { isRest: true, dur: "2n" },
    { note: "G5", dur: "8n" }, { note: "F5", dur: "8n" },
    { note: "E5", dur: "4n" },
];

const furyPart = buildLoop('fury', furySynth, furyNotes);

// =====================================================================
//  ЭМОЦИИ: какие партии и главный синт у каждой
// =====================================================================
const parts = {
    happiness: [happinessPart, calmPart, inspoPart, gratPart],
    sadness:   [sadPart, lonelyPart, fatiguePart, regretPart],
    anger:     [angerPart, bassPart, detunePart, tensionPart, furyPart],
};

const mainSynth = {
    happiness: happinessSynth,
    sadness: sadSynth,
    anger: angerSynth,
};

// Все петли привязаны к нулю транспорта и всегда начинаются вместе
Object.entries(parts).forEach(([emotion, list]) => {
    list.forEach(p => {
        p.mute = emotion !== 'happiness';
        p.start(0);
    });
});

// Подписи, которые меняются от вкладки к вкладке
const LABELS = {
    happiness: { chorus: 'phaser', k1: 'calmness',   k2: 'inspiration', k3: 'gratitude' },
    sadness:   { chorus: 'chorus', k1: 'loneliness', k2: 'fatigue',     k3: 'regret' },
    anger:     { chorus: 'phaser', k1: 'rage',       k2: 'tension',     k3: 'fury' },
};

// Что делает каждый слайдер и каждая крутилка в каждой вкладке.
// Слайдер даёт p: 0 (слева) … 1 (справа).
// Крутилка даёт level: 0 (сверху) … 1 (до упора по часовой).
const CONTROLS = {
    happiness: {
        freeverb:   p => { freeVerb.wet.value = p; },
        delay:      p => { happinessDelay.delayTime.value = 0.05 + p * 0.35; happinessDelay.wet.value = p; },
        chorus:     p => { chorusEffect.wet.value = p; },
        distortion: p => { distEffect.wet.value = p; },
        attack:     p => { happinessSynth.envelope.attack = 0.005 + p * 1.0; },
        decay:      p => { happinessSynth.envelope.decay = 0.05 + p * 2; },
        sustain:    p => { happinessSynth.envelope.sustain = p; },
        release:    p => { happinessSynth.envelope.release = 0.05 + p * 3; },

        k1:     l => { calmSynth.volume.value = toDb(l); },
        k2:     l => { inspoSynth.volume.value = toDb(l); },
        k3:     l => { gratSynth.volume.value = toDb(l * 0.6); },
        volume: l => { happinessSynth.volume.value = toDb(1 - l); },
    },
    sadness: {
        freeverb:   p => { sadReverb.wet.value = p; },
        delay:      p => { sadDelay.wet.value = p * 0.7; },
        chorus:     p => { sadChorus.wet.value = p; },
        distortion: p => { sadDist.wet.value = p; },
        attack:     p => { sadSynth.envelope.attack = 0.005 + p * 1.5; },
        decay:      p => { sadSynth.envelope.decay = 0.05 + p * 2; },
        sustain:    p => { sadSynth.envelope.sustain = p; },
        release:    p => { sadSynth.envelope.release = 0.05 + p * 4; },

        k1:     l => { lonelySynth.volume.value = toDb(l * 0.7); },
        k2:     l => { fatigueSynth.volume.value = toDb(l * 0.5); },
        k3:     l => { regretSynth.volume.value = toDb(l * 0.5); },
        volume: l => { sadSynth.volume.value = toDb(1 - l); },
    },
    anger: {
        freeverb:   p => { angerReverb.wet.value = p; },
        delay:      p => { angerDelay.wet.value = p * 0.6; },
        chorus:     p => { angerPhaser.wet.value = p; },   // слайдер phaser
        distortion: p => { angerDist.wet.value = p; },
        attack:   p => { angerSynth.envelope.attack = 0.005 + p * 0.5; },
        decay:    p => { angerSynth.envelope.decay = 0.02 + p * 0.5; },
        sustain:  p => { angerSynth.envelope.sustain = p; },
        release:  p => { angerSynth.envelope.release = 0.02 + p * 1; },

        k1: l => {                              // rage: дубль громче и сильнее расстроен
            detuneSynth.volume.value = toDb(l * 0.5);
            detuneSynth.detune.value = 10 + l * 40;
        },
        k2:     l => { tensionSynth.volume.value = toDb(l * 0.35); },
        k3:     l => { furySynth.volume.value = toDb(l * 0.4); },
        volume: l => { angerMaster.volume.value = toDb(1 - l); },
    },
};

// Запоминаем положение всех слайдеров и крутилок отдельно для каждой вкладки
const saved = { happiness: {}, sadness: {}, anger: {} };
let currentEmotion = 'happiness';

// =====================================================================
//  ИНТЕРФЕЙС
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {

    // --- Mute ---
    const muteBtn = document.getElementById('mutecontroller');
    if (muteBtn) {
        let isMuted = false;
        muteBtn.addEventListener('click', async () => {
            await Tone.start();
            isMuted = !isMuted;
            Tone.Destination.mute = isMuted;          // транспорт продолжает идти
            muteBtn.classList.toggle('muted', isMuted);
        });
    }

    // --- Кнопки формы волны ---
    const container = document.querySelector('.wave-buttons');
    const waveButtons = container ? container.querySelectorAll('.wave-btn') : [];

    function updateWaveHighlight() {
        if (!container) return;
        const activeBtn = container.querySelector('.wave-btn.active');
        if (!activeBtn) return;
        const rect = activeBtn.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const left = rect.left - containerRect.left;
        const width = rect.width + 16;
        container.style.setProperty('--btn-left', (left - 8) + 'px');
        container.style.setProperty('--btn-width', width + 'px');
    }

    // Подсветить кнопку той волны, что сейчас у главного синта вкладки
    function showWave(type) {
        waveButtons.forEach(b => b.classList.toggle('active', b.dataset.type === type));
        updateWaveHighlight();
    }

    waveButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            mainSynth[currentEmotion].oscillator.type = btn.dataset.type;
            showWave(btn.dataset.type);
        });
    });
    window.addEventListener('resize', updateWaveHighlight);

    // --- Горизонтальные слайдеры ---
    const sliders = {};

    function initSlider(key, containerSel, thumbSel) {
        const box = document.querySelector(containerSel);
        if (!box) { console.warn(`Элемент ${containerSel} не найден`); return; }
        const thumb = box.querySelector(thumbSel);
        if (!thumb) { console.error(`Элемент ${thumbSel} не найден внутри ${containerSel}`); return; }

        let dragging = false, startX = 0, startLeft = 0;

        thumb.addEventListener('mousedown', (e) => {
            dragging = true;
            startX = e.clientX;
            startLeft = thumb.getBoundingClientRect().left - box.getBoundingClientRect().left;
        });

        document.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            const maxLeft = box.offsetWidth - thumb.offsetWidth;
            const newLeft = Math.max(0, Math.min(startLeft + e.clientX - startX, maxLeft));
            thumb.style.left = newLeft + 'px';
            const p = maxLeft > 0 ? newLeft / maxLeft : 0;
            saved[currentEmotion][key] = p;
            const fn = CONTROLS[currentEmotion][key];
            if (fn) fn(p);
        });

        document.addEventListener('mouseup', () => { dragging = false; });

        // Поставить ползунок в сохранённое положение (при смене вкладки)
        sliders[key] = (p) => {
            const maxLeft = box.offsetWidth - thumb.offsetWidth;
            thumb.style.left = (p * maxLeft) + 'px';
        };
    }

    initSlider('freeverb',   '.freeverbcont',   '.slider-thumb');
    initSlider('delay',      '.delaycont',      '.slider-thumb1');
    initSlider('chorus',     '.choruscont',     '.slider-thumb2');
    initSlider('distortion', '.distortioncont', '.slider-thumb3');
    initSlider('attack',     '.attackcont',     '.slider-thumba');
    initSlider('decay',      '.decaycont',      '.slider-thumbd');
    initSlider('sustain',    '.sustaincont',    '.slider-thumbs');
    initSlider('release',    '.releasecont',    '.slider-thumbr');

    // При изменении размера окна ставим ползунки на те же доли, что и были
    window.addEventListener('resize', () => {
        const s = saved[currentEmotion];
        Object.keys(sliders).forEach(k => sliders[k](s[k] || 0));
    });

    // --- Крутилки: 0° (сверху) → level 0, 270° → level 1 ---
    const knobs = {};
    function addKnob(key, markSel, contSel) {
        knobs[key] = initMarkKnob(markSel, contSel, (deg) => {
            saved[currentEmotion][key] = deg;
            const fn = CONTROLS[currentEmotion][key];
            if (fn) fn(deg / 270);
        });
    }
    addKnob('k1',     '.calmnesscont .mark',      '.calmnesscont');
    addKnob('k2',     '.inspirationcont .mark2',  '.inspirationcont');
    addKnob('k3',     '.gratitudecont .mark3',    '.gratitudecont');
    addKnob('volume', '.volumecont .mark4',       '.volumecont');

    // --- Показать вкладку: цвет, подписи, положения ручек ---
    function showEmotionUI(emotion) {
        document.body.dataset.emotion = emotion; // цвет и раскладка — в CSS

        const L = LABELS[emotion];
        document.querySelector('.chorus p').textContent = L.chorus;
        document.querySelector('.calmness p').textContent = L.k1;
        document.querySelector('.inspo p').textContent = L.k2;
        document.querySelector('.gratitude p').textContent = L.k3;

        showWave(mainSynth[emotion].oscillator.type);

        const s = saved[emotion];
        Object.keys(sliders).forEach(k => sliders[k](s[k] || 0));
        Object.keys(knobs).forEach(k => knobs[k] && knobs[k].setDeg(s[k] || 0));
    }

    // --- Включить звук вкладки ---
    async function playEmotion(emotion, changed) {
        await Tone.start();

        Object.entries(parts).forEach(([e, list]) => {
            list.forEach(p => { p.mute = e !== emotion; });
            buses[e].gain.rampTo(e === emotion ? 1 : 0, 0.1);
        });

        // Новая вкладка (или первый запуск) — играем с начала в её темпе
        if (changed || Tone.Transport.state !== 'started') {
            Tone.Transport.stop();
            Tone.Transport.bpm.value = BPM[emotion];
            Tone.Transport.position = 0;
            Tone.Transport.start('+0.1');
        }
    }

    // --- Переключатель эмоций ---
    const emotionBox = document.querySelector('.emotion-buttons');
    if (emotionBox) {
        const emotionBtns = emotionBox.querySelectorAll('.emotion-btn');

        function moveEmotionHighlight() {
            const active = emotionBox.querySelector('.emotion-btn.active');
            if (!active) {
                emotionBox.style.setProperty('--btn-left', '0px');
                emotionBox.style.setProperty('--btn-width', '0px');
                return;
            }
            const rect = active.getBoundingClientRect();
            const containerRect = emotionBox.getBoundingClientRect();
            emotionBox.style.setProperty('--btn-left', (rect.left - containerRect.left - 8) + 'px');
            emotionBox.style.setProperty('--btn-width', (rect.width + 16) + 'px');
        }

        emotionBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const emotion = btn.dataset.emotion;

                emotionBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                moveEmotionHighlight();

                const changed = emotion !== currentEmotion;
                currentEmotion = emotion;
                showEmotionUI(emotion);
                await playEmotion(emotion, changed);
            });
        });

        window.addEventListener('resize', moveEmotionHighlight);
        moveEmotionHighlight();
    } else {
        console.error('❌ Блок .emotion-buttons не найден!');
    }

    showEmotionUI('happiness');
});

// =====================================================================
//  КРУТИЛКА
//  onValueChange получает угол 0..270 (0 — сверху, по часовой).
//  Возвращает { setDeg }, чтобы ставить ручку в нужное положение.
// =====================================================================
function initMarkKnob(markSelector, containerSelector, onValueChange) {
    const mark = document.querySelector(markSelector);
    const container = document.querySelector(containerSelector);

    if (!mark || !container) {
        console.error('❌ Элементы не найдены:', markSelector, containerSelector);
        return null;
    }

    let isDragging = false;
    let radius = 0;
    let centerX = 0;
    let centerY = 0;
    let lastDeg = 0; // своё значение у каждой крутилки

    function place(deg) {
        const a = deg * Math.PI / 180;
        const x = radius * Math.sin(a);
        const y = -radius * Math.cos(a);
        mark.style.transform =
            'translate(-50%, -50%) translate(' + x + 'px, ' + y + 'px) rotate(' + deg + 'deg)';
    }

    function updateGeometry() {
        const cRect = container.getBoundingClientRect();
        const mRect = mark.getBoundingClientRect();

        centerX = cRect.left + cRect.width / 2;
        centerY = cRect.top + cRect.height / 2;

        const baseRadius = (cRect.width / 2) - (mRect.height / 2);
        radius = baseRadius * 0.65;

        if (!isDragging) place(lastDeg);
    }

    updateGeometry();
    window.addEventListener('resize', updateGeometry);

    function getAngleDeg(e) {
        let angleRad = Math.atan2(e.clientY - centerY, e.clientX - centerX) + Math.PI / 2;
        while (angleRad < 0) angleRad += Math.PI * 2;
        while (angleRad >= Math.PI * 2) angleRad -= Math.PI * 2;
        return angleRad * (180 / Math.PI); // 0..360, 0 — верх, по часовой
    }

    container.addEventListener('mousedown', (e) => {
        if (e.target === mark || mark.contains(e.target)) {
            isDragging = true;
            e.preventDefault();
            updateGeometry();
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        let angleDeg = getAngleDeg(e);

        // Мёртвая зона 270..360: прижимаем к ближайшему краю
        if (angleDeg > 270) {
            angleDeg = lastDeg > 135 ? 270 : 0;
        }
        lastDeg = angleDeg;
        place(angleDeg);

        if (typeof onValueChange === 'function') {
            onValueChange(angleDeg);
        }
    });

    return {
        setDeg(deg) {
            lastDeg = deg;
            place(deg);
        }
    };
}

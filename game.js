(() => {
  "use strict";

  const app = document.querySelector("#app");
  const teams = window.GAME_TEAMS;
  const phases = ["Oitavas de Final", "Quartas de Final", "Semifinal", "Grande Final"];
  const positions = { GOL: 1, LD: 1, LE: 1, ZAG: 2, MEI: 3, PE: 1, PD: 1, CA: 1 };
  const slots = [
    { pos: "PE", x: 18, y: 17 },
    { pos: "CA", x: 50, y: 14 },
    { pos: "PD", x: 82, y: 17 },
    { pos: "MEI", x: 37, y: 40 },
    { pos: "MEI", x: 63, y: 40 },
    { pos: "MEI", x: 50, y: 53 },
    { pos: "LE", x: 18, y: 63 },
    { pos: "ZAG", x: 40, y: 73 },
    { pos: "ZAG", x: 60, y: 73 },
    { pos: "LD", x: 82, y: 63 },
    { pos: "GOL", x: 50, y: 88 },
  ];
  const matchDuration = 18_000;
  let state;
  let rollToken = 0;
  let matchTimer = null;
  let animationTimer = null;

  function newState() {
    return {
      screen: "setup",
      teamName: "",
      modeAdm: false,
      rosterClub: null,
      selectedPlayer: null,
      lineup: Array(11).fill(null),
      rerolls: 3,
      rolling: false,
      matches: [],
      usedOpponents: new Set(),
      currentMatch: null,
      stats: { wins: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 },
      champion: false,
    };
  }

  function overall(roster) {
    const starters = [];
    for (const [pos, count] of Object.entries(positions)) {
      const candidates = roster
        .filter((player) => player.pos === pos)
        .sort((a, b) => b.ovr - a.ovr);
      if (candidates.length < count) throw new Error(`Elenco sem jogadores suficientes para ${pos}.`);
      starters.push(...candidates.slice(0, count));
    }
    return Math.floor(starters.reduce((sum, player) => sum + player.ovr, 0) / starters.length);
  }

  function teamOverall() {
    return state.modeAdm ? 99 : Math.floor(state.lineup.reduce((sum, player) => sum + player.ovr, 0) / 11);
  }

  function attackOverall() {
    const players = state.lineup.filter((player) => player && ["PE", "PD", "CA"].includes(player.pos));
    return players.length ? Math.floor(players.reduce((sum, player) => sum + player.ovr, 0) / players.length) : "--";
  }

  function defenseOverall() {
    const players = state.lineup.filter((player) => player && ["GOL", "LD", "LE", "ZAG"].includes(player.pos));
    return players.length ? Math.floor(players.reduce((sum, player) => sum + player.ovr, 0) / players.length) : "--";
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char]);
  }

  function header(subtitle, action = "") {
    return `
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark"><b>7</b> a 0</div>
          <div class="brand-copy"><strong>SETE A ZERO</strong><span>Copa do Brasil Edition</span></div>
        </div>
        <div class="top-spacer"></div>
        <div class="mode-pill">4-3-3 &nbsp;·&nbsp; Equilibrado &nbsp;·&nbsp; Clássico</div>
        ${action}
      </header>
      <p class="eyebrow" style="margin-top:13px">${esc(subtitle)}</p>`;
  }

  function pitch({ draft = false, preview = false } = {}) {
    const drawn = slots.map((slot, index) => {
      const player = state.lineup[index];
      const compatible = draft && state.selectedPlayer && state.selectedPlayer.pos === slot.pos && !player;
      const classes = ["pitch-slot", player ? "is-filled" : "", compatible ? "is-compatible" : ""].filter(Boolean).join(" ");
      const label = player
        ? `<strong>${player.ovr}</strong><small>${esc(player.nome.split(" ").at(-1))}</small>`
        : `<strong>${slot.pos}</strong>`;
      const title = player ? `${player.nome} · ${player.pos} · OVR ${player.ovr}` : `${slot.pos}${compatible ? " — clique para escalar" : ""}`;
      const button = draft && !state.rolling
        ? `<button class="${classes}" type="button" style="left:${slot.x}%;top:${slot.y}%" data-slot="${index}" aria-label="${esc(title)}" title="${esc(title)}">${label}</button>`
        : `<div class="${classes}" style="left:${slot.x}%;top:${slot.y}%" title="${esc(title)}">${label}</div>`;
      return button;
    }).join("");
    return `
      <div class="pitch ${preview ? "setup-pitch" : ""}" aria-label="Campo de futebol com formação 4-3-3">
        <div class="pitch-box pitch-box-top"></div><div class="pitch-small-box pitch-small-top"></div>
        <div class="pitch-box pitch-box-bottom"></div><div class="pitch-small-box pitch-small-bottom"></div>
        <div class="pitch-center-dot"></div>${drawn}
      </div>`;
  }

  function renderSetup(message = "") {
    app.innerHTML = `
      ${header("Monte seu time e dispute a Copa do Brasil")}
      <section class="setup-grid">
        <div>
          <div class="page-heading">
            <p class="eyebrow">Uma campanha. Quatro decisões.</p>
            <h1 class="display-title">Monte seu time<br>dos sonhos</h1>
            <p class="subheading">Complete o 4-3-3 e conquiste a Copa do Brasil.</p>
          </div>
          <form id="setup-form" class="setup-card">
            <label class="field-label" for="team-name">Nome do time</label>
            <input id="team-name" name="team-name" class="team-name-input" type="text" maxlength="24"
              placeholder="Digite o nome do seu time" autocomplete="off" required value="${esc(state.teamName)}">
            <div class="setup-options">
              <div><span class="field-label">Formação</span><div class="option-value">4-3-3</div></div>
              <div><span class="field-label">Estilo</span><div class="option-value">Equilibrado</div></div>
              <div><span class="field-label">Dificuldade</span><div class="option-value">Clássica</div></div>
            </div>
            <p class="setup-help">A campanha começa nas oitavas de final.</p>
            <p class="setup-help">Digite ADM para testar com overall 99.</p>
            <p class="setup-note" role="alert">${esc(message)}</p>
            <button class="button button-primary button-wide button-label" type="submit">Começar draft <span aria-hidden="true">→</span></button>
          </form>
        </div>
        ${pitch({ preview: true })}
      </section>
      <p class="footer-note">7 a 0 · Copa do Brasil Edition</p>`;
    const input = app.querySelector("#team-name");
    input.addEventListener("input", () => { state.teamName = input.value; });
    app.querySelector("#setup-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const name = input.value.trim();
      if (!name) {
        input.focus();
        renderSetup("Digite o nome do seu time para continuar.");
        app.querySelector("#team-name").focus();
        return;
      }
      state.teamName = name;
      state.modeAdm = name.toLocaleLowerCase("pt-BR") === "adm";
      if (state.modeAdm) state.teamName = "Modo ADM FC";
      state.screen = "draft";
      state.lineup = Array(11).fill(null);
      state.selectedPlayer = null;
      state.rerolls = 3;
      renderDraft();
      drawClub(null);
    });
    input.focus();
  }

  function renderDraft() {
    const complete = state.lineup.every(Boolean);
    const currentPlayers = state.rosterClub ? teams[state.rosterClub] : [];
    const selectedKey = state.selectedPlayer ? `${state.selectedPlayer.club}::${state.selectedPlayer.nome}` : "";
    const rosterMarkup = currentPlayers.map((player, index) => {
      const key = `${state.rosterClub}::${player.nome}`;
      const alreadyPicked = state.lineup.some((picked) => picked && picked.club === state.rosterClub && picked.nome === player.nome);
      const positionFull = state.lineup.filter((picked) => picked && picked.pos === player.pos).length >= positions[player.pos];
      const disabled = state.rolling || alreadyPicked || positionFull;
      return `
        <button class="player-row ${key === selectedKey ? "is-selected" : ""}" type="button"
          data-player="${index}" ${disabled ? "disabled" : ""}>
          <span class="player-number">${String(index + 1).padStart(2, "0")}</span>
          <span class="player-name">${esc(player.nome)}</span>
          <span class="player-position">${esc(player.pos)}</span>
          <span class="player-ovr">${player.ovr}</span>
        </button>`;
    }).join("");

    const lineupMarkup = slots.map((slot, index) => {
      const player = state.lineup[index];
      return `<div class="lineup-row">
        <span class="lineup-position">${slot.pos}</span>
        <span class="lineup-name ${player ? "" : "lineup-empty"}">${player ? esc(player.nome) : "Escolha um jogador"}</span>
        <span class="lineup-ovr">${player ? player.ovr : "—"}</span>
      </div>`;
    }).join("");

    app.innerHTML = `
      ${header(`Draft do elenco · ${state.lineup.filter(Boolean).length}/11`)}
      <section class="draft-toolbar">
        <div class="drawn-club ${state.rolling ? "is-rolling" : ""}">
          <span class="draw-status">${state.rolling ? "Sorteando clube..." : "Clube sorteado"}</span>
          <strong id="drawn-club-name">${esc(state.rosterClub || "Preparando sorteio...")}</strong>
        </div>
        <p class="toolbar-note">${esc(state.selectedPlayer
          ? `Agora clique em uma vaga ${state.selectedPlayer.pos} destacada no campo.`
          : complete ? "Escalação completa. A Copa começa nas Oitavas." : "Escolha um jogador compatível com as vagas restantes.")}</p>
        ${complete
          ? `<button class="button button-primary button-label" type="button" data-action="start-cup">Simular Copa →</button>`
          : `<button class="button reroll-button" type="button" data-action="reroll" ${state.rolling || state.rerolls === 0 ? "disabled" : ""}>↻ Re-sorteio <b>${state.rerolls}</b></button>`}
      </section>
      <section class="draft-grid">
        <article class="panel">
          <div class="panel-heading"><h2>Jogadores disponíveis</h2><span>${currentPlayers.length} atletas</span></div>
          <div class="player-list">${rosterMarkup}</div>
        </article>
        <div class="draft-pitch-wrap">
          ${pitch({ draft: true })}
          <p class="pitch-help">${state.selectedPlayer ? "Escolha uma posição compatível para confirmar." : "Selecione um jogador; depois, clique na posição destacada."}</p>
        </div>
        <aside class="panel">
          <div class="panel-heading"><h2>Minha escalação</h2><span>${state.lineup.filter(Boolean).length}/11</span></div>
          <div class="overall-card"><span>OVERALL GERAL</span><strong>${complete ? teamOverall() : "—"}</strong></div>
          <div class="team-scores"><span class="attack-label">ATAQUE<b>${attackOverall()}</b></span><span>DEFESA<b>${defenseOverall()}</b></span></div>
          <div class="lineup-list">${lineupMarkup}</div>
        </aside>
      </section>
      <p class="footer-note">Seu elenco mistura jogadores dos clubes históricos e atuais cadastrados.</p>`;

    app.querySelectorAll("[data-player]").forEach((button) => {
      button.addEventListener("click", () => {
        const player = currentPlayers[Number(button.dataset.player)];
        state.selectedPlayer = { ...player, club: state.rosterClub };
        renderDraft();
      });
    });
    app.querySelectorAll("[data-slot]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!state.selectedPlayer) return;
        const index = Number(button.dataset.slot);
        if (slots[index].pos !== state.selectedPlayer.pos || state.lineup[index]) return;
        state.lineup[index] = state.selectedPlayer;
        const previousClub = state.rosterClub;
        state.selectedPlayer = null;
        if (state.lineup.every(Boolean)) {
          renderDraft();
        } else {
          renderDraft();
          drawClub(previousClub);
        }
      });
    });
    app.querySelector('[data-action="reroll"]')?.addEventListener("click", () => {
      if (state.rolling || state.rerolls <= 0) return;
      state.rerolls -= 1;
      const previousClub = state.rosterClub;
      renderDraft();
      drawClub(previousClub);
    });
    app.querySelector('[data-action="start-cup"]')?.addEventListener("click", startCup);
  }

  function drawClub(previousClub) {
    const options = Object.keys(teams).filter((club) => club !== previousClub);
    if (!options.length) throw new Error("Não há clubes suficientes para continuar o draft.");
    const target = options[Math.floor(Math.random() * options.length)];
    state.rolling = true;
    state.selectedPlayer = null;
    state.rosterClub = options[Math.floor(Math.random() * options.length)];
    const token = ++rollToken;
    const started = performance.now();
    renderDraft();

    function tick() {
      if (token !== rollToken || state.screen !== "draft") return;
      const progress = Math.min(1, (performance.now() - started) / 1500);
      if (progress >= 1) {
        state.rosterClub = target;
        state.rolling = false;
        renderDraft();
        return;
      }
      let next = options[Math.floor(Math.random() * options.length)];
      if (options.length > 1 && next === state.rosterClub) {
        next = options[(options.indexOf(next) + 1) % options.length];
      }
      state.rosterClub = next;
      const label = app.querySelector("#drawn-club-name");
      if (label) label.textContent = next;
      const wait = 45 + progress * progress * 185;
      animationTimer = window.setTimeout(tick, wait);
    }
    animationTimer = window.setTimeout(tick, 45);
  }

  function simulateScore(opponent) {
    const myOverall = teamOverall();
    const opponentOverall = overall(teams[opponent]);
    const diff = myOverall - opponentOverall;
    const winChance = Math.max(10, Math.min(80, 45 + diff * 3));
    const drawChance = Math.abs(diff) <= 3 ? 25 : 10;
    const roll = Math.floor(Math.random() * 100) + 1;
    let home;
    let away;
    if (roll <= winChance) {
      home = randomInt(1, 4);
      away = randomInt(0, home - 1);
    } else if (roll <= winChance + drawChance) {
      home = away = randomInt(0, 3);
    } else {
      away = randomInt(1, 4);
      home = randomInt(0, away - 1);
    }

    const myScorers = state.lineup.filter((player) => player.pos !== "GOL");
    const opponentScorers = teams[opponent].filter((player) => player.pos !== "GOL");
    const events = [];
    for (let i = 0; i < home; i++) {
      const scorer = myScorers[randomInt(0, myScorers.length - 1)];
      events.push({ minute: randomInt(1, 90), side: "home", scorer: scorer.nome });
    }
    for (let i = 0; i < away; i++) {
      const scorer = opponentScorers[randomInt(0, opponentScorers.length - 1)];
      events.push({ minute: randomInt(1, 90), side: "away", scorer: scorer.nome });
    }
    events.sort((a, b) => a.minute - b.minute);
    return { home, away, opponentOverall, events };
  }

  function simulatePenalties(opponent) {
    const homeKickers = [...state.lineup].sort((a, b) => b.ovr - a.ovr);
    const awayKickers = [...teams[opponent]].sort((a, b) => b.ovr - a.ovr);
    const score = { home: 0, away: 0 };
    const kicks = [];
    let round = 0;
    let winner = null;
    while (winner === null) {
      for (const side of ["home", "away"]) {
        const roster = side === "home" ? homeKickers : awayKickers;
        const kicker = roster[round % roster.length];
        const chance = state.modeAdm && side === "home" ? 99 : kicker.ovr;
        const goal = Math.floor(Math.random() * 100) + 1 <= chance;
        if (goal) score[side] += 1;
        kicks.push({
          side,
          name: kicker.nome,
          pos: kicker.pos,
          goal,
          homeScore: score.home,
          awayScore: score.away,
        });
      }
      round += 1;
      const difference = Math.abs(score.home - score.away);
      if ((round < 5 && difference > 5 - round) || (round >= 5 && score.home !== score.away)) {
        winner = score.home > score.away;
      }
    }
    return { kicks, winner, home: score.home, away: score.away };
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function startCup() {
    if (!state.lineup.every(Boolean)) return;
    state.screen = "cup";
    state.matches = [];
    state.usedOpponents = new Set();
    state.stats = { wins: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
    state.champion = false;
    startMatch();
  }

  function startMatch() {
    const available = Object.keys(teams).filter((club) => !state.usedOpponents.has(club));
    const opponent = available[randomInt(0, available.length - 1)];
    state.usedOpponents.add(opponent);
    const result = simulateScore(opponent);
    const match = {
      phase: phases[state.matches.length],
      opponent,
      opponentOverall: result.opponentOverall,
      home: result.home,
      away: result.away,
      liveHome: 0,
      liveAway: 0,
      events: result.events,
      shownGoals: 0,
      logs: [],
      status: "live",
      minute: 0,
      startedAt: performance.now(),
      kicks: [],
      shownKicks: 0,
      homePenalties: 0,
      awayPenalties: 0,
      penaltyWinner: null,
      penaltyStartedAt: 0,
      nextKickAt: 0,
      winner: null,
    };
    state.currentMatch = match;
    state.matches.push(match);
    renderCup();
    window.clearInterval(matchTimer);
    matchTimer = window.setInterval(updateLiveMatch, 100);
  }

  function updateLiveMatch() {
    const match = state.currentMatch;
    if (!match) return;
    if (match.status === "live") {
      const elapsed = Math.min(matchDuration, performance.now() - match.startedAt);
      const minute = Math.min(90, Math.floor((elapsed / matchDuration) * 90));
      let changed = minute !== match.minute;
      match.minute = minute;
      while (match.shownGoals < match.events.length && match.events[match.shownGoals].minute <= minute) {
        const event = match.events[match.shownGoals++];
        if (event.side === "home") match.liveHome += 1;
        else match.liveAway += 1;
        match.logs.push(event);
        changed = true;
      }
      if (elapsed >= matchDuration) {
        window.clearInterval(matchTimer);
        if (match.home === match.away) {
          beginPenalties(match);
        } else {
          finishMatch(match.home > match.away);
        }
        return;
      }
      if (changed) renderCup();
    } else if (match.status === "penalties" && performance.now() >= match.nextKickAt) {
      const kick = match.kicks[match.shownKicks++];
      if (kick) {
        match.homePenalties = kick.homeScore;
        match.awayPenalties = kick.awayScore;
        match.nextKickAt = performance.now() + 900;
        if (match.shownKicks === match.kicks.length) {
          renderCup();
          window.setTimeout(() => finishMatch(match.penaltyWinner), 750);
          return;
        }
      }
      renderCup();
    }
  }

  function beginPenalties(match) {
    const shootout = simulatePenalties(match.opponent);
    match.status = "penalties";
    match.kicks = shootout.kicks;
    match.penaltyWinner = shootout.winner;
    match.finalHomePenalties = shootout.home;
    match.finalAwayPenalties = shootout.away;
    match.nextKickAt = performance.now() + 850;
    renderCup();
    matchTimer = window.setInterval(updateLiveMatch, 100);
  }

  function finishMatch(winner) {
    window.clearInterval(matchTimer);
    const match = state.currentMatch;
    if (match.status === "finished") return;
    match.status = "finished";
    match.winner = winner;
    state.stats.goalsFor += match.home;
    state.stats.goalsAgainst += match.away;
    if (winner) state.stats.wins += 1;
    else state.stats.losses += 1;
    state.champion = winner && state.matches.length === phases.length;
    renderCup();
  }

  function renderCup() {
    const match = state.currentMatch;
    if (!match) return;
    const active = match.status !== "finished";
    const scoreHome = match.status === "live" ? match.liveHome : match.home;
    const scoreAway = match.status === "live" ? match.liveAway : match.away;
    const statusText = match.status === "live"
      ? `${match.minute}' · EM ANDAMENTO`
      : match.status === "penalties"
        ? `PÊNALTIS · ${match.homePenalties} - ${match.awayPenalties}`
        : match.kicks.length
          ? `PÊNALTIS · ${match.homePenalties} - ${match.awayPenalties}`
          : "FIM DE JOGO";
    const rounds = state.matches.map((item, index) => {
      const isCurrent = index === state.matches.length - 1;
      const liveHome = item.status === "live" ? item.liveHome : item.home;
      const liveAway = item.status === "live" ? item.liveAway : item.away;
      const scoreClass = item.status === "finished" ? (item.winner ? "is-win" : "is-loss") : "";
      const score = `${liveHome} - ${liveAway}${item.kicks.length && item.status !== "live" ? " pen." : ""}`;
      const detail = item.status === "live" ? `AO VIVO · ${item.minute}'`
        : item.status === "penalties" ? "DISPUTA DE PÊNALTIS"
          : item.status === "finished" ? (item.winner ? "CLASSIFICADO" : "ELIMINADO") : "Aguardando";
      return `<article class="round-card ${isCurrent ? "is-current" : ""}">
        <span class="round-name">${esc(item.phase)}</span>
        <span class="round-opponent">${esc(item.opponent)}</span>
        <span class="round-score ${scoreClass}">${score}</span>
        <span class="round-detail">${detail}</span>
      </article>`;
    }).join("");
    const events = match.logs.slice(-8).map((event) => {
      const scorer = event.side === "home" ? state.teamName : match.opponent;
      return `<li><span class="event-minute">${event.minute}'</span><span><b>${esc(scorer)}</b> · ${esc(event.scorer)}</span></li>`;
    }).join("");
    const penalties = match.kicks.length ? `
      <div class="penalties">
        <div class="penalties-title">Disputa de pênaltis · cobrança alternada</div>
        <div class="penalty-columns">
          ${["home", "away"].map((side) => {
            const kicks = match.kicks.slice(0, match.shownKicks).filter((kick) => kick.side === side);
            return `<div>${kicks.map((kick) => `<div class="penalty-row">
              <span class="penalty-mark ${kick.goal ? "is-goal" : "is-miss"}">${kick.goal ? "●" : "×"}</span>
              <span class="penalty-name">${esc(kick.name)} <small>(${kick.pos})</small></span>
            </div>`).join("")}</div>`;
          }).join("")}
        </div>
        ${match.status === "finished" ? `<div class="penalty-score">${match.homePenalties} - ${match.awayPenalties} · ${match.winner ? "CLASSIFICADO" : "ELIMINADO"}</div>` : ""}
      </div>` : "";

    app.innerHTML = `
      ${header("Copa do Brasil · Campanha")}
      <section class="match-banner">
        <div class="match-team"><span class="eyebrow">${esc(match.phase)}</span><strong>${esc(state.teamName)}</strong><small>OVR ${teamOverall()}</small></div>
        <div class="match-center"><div class="match-score">${scoreHome} <span>—</span> ${scoreAway}</div><div class="match-clock">${statusText}</div></div>
        <div class="match-team"><span class="eyebrow">ADVERSÁRIO</span><strong>${esc(match.opponent)}</strong><small>OVR ${match.opponentOverall}</small></div>
      </section>
      <section class="campaign-grid">
        <div><p class="eyebrow">Caminho do mata-mata</p><div class="round-list">${rounds}</div></div>
        <aside class="match-events">
          <div class="panel-heading"><h2>${match.status === "penalties" || (match.status === "finished" && penalties) ? "Disputa de pênaltis" : "Lances da partida"}</h2><span>${match.status === "live" ? "AO VIVO" : ""}</span></div>
          ${penalties || (events ? `<ul class="event-list">${events}</ul>` : `<p class="live-note">${match.status === "live" ? "A bola está rolando. O jogo dura 18 segundos." : "Nenhum gol nesta partida."}</p>`)}
        </aside>
      </section>
      ${active
        ? `<p class="footer-note">${match.status === "live" ? "A partida termina automaticamente em 18 segundos." : "As cobranças são reveladas uma a uma."}</p>`
        : `<div class="match-actions"><button class="button button-primary button-label" data-action="continue">${state.champion || !match.winner ? "Ver resultado da campanha" : "Próximo jogo →"}</button></div>`}`;

    app.querySelector('[data-action="continue"]')?.addEventListener("click", () => {
      if (state.champion || !match.winner) {
        state.screen = "results";
        renderResults();
      } else {
        startMatch();
      }
    });
  }

  function renderResults() {
    window.clearInterval(matchTimer);
    const played = state.matches;
    const campaignWon = state.champion;
    const history = played.map((match) => `
      <article class="round-card">
        <span class="round-name">${esc(match.phase)}</span>
        <span class="round-opponent">${esc(match.opponent)}</span>
        <span class="round-score ${match.winner ? "is-win" : "is-loss"}">${match.home} - ${match.away}${match.kicks.length ? ` (${match.homePenalties}-${match.awayPenalties} pen.)` : ""}</span>
      </article>`).join("");
    app.innerHTML = `
      ${header("Resultado da campanha")}
      <div class="result-title"><p class="eyebrow">${campaignWon ? "Campanha completa" : "Fim de campanha"}</p><h1 class="display-title">${campaignWon ? "Campeão da Copa do Brasil" : "A jornada continua"}</h1><p class="subheading">${esc(state.teamName)}</p></div>
      <section class="result-card">
        <div class="result-champion"><strong>${campaignWon ? "Campeão" : "Campanha"}</strong><span>${state.stats.wins}/${phases.length}</span></div>
        <div class="result-stats"><h2>Desempenho</h2><p>${state.stats.wins} vitórias &nbsp;·&nbsp; ${state.stats.losses} derrotas</p><p>${state.stats.goalsFor} gols pró &nbsp;·&nbsp; ${state.stats.goalsAgainst} sofridos</p></div>
      </section>
      <section class="result-history"><p class="eyebrow">Trajetória no mata-mata</p>${history}</section>
      <div class="result-actions"><button class="button button-primary button-label" data-action="restart">Nova campanha →</button></div>`;
    app.querySelector('[data-action="restart"]').addEventListener("click", () => {
      window.clearTimeout(animationTimer);
      window.clearInterval(matchTimer);
      ++rollToken;
      state = newState();
      renderSetup();
    });
  }

  if (!teams || Object.keys(teams).length === 0) {
    app.innerHTML = "<p>Não foi possível carregar os elencos. Atualize a página e tente novamente.</p>";
    return;
  }
  state = newState();
  renderSetup();
})();

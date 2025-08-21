window.addEventListener("DOMContentLoaded", () => {
  const API_KEY = "c7c759aa3a7a2e5add875c2ff4c8345e";

  // ===== Configs de tema/override
  const THEME_KEY = "appTheme";
  const THEME_OVERRIDE_TS = "appThemeManualTs";
  const THEME_OVERRIDE_TTL_MIN = 30; // minutos respeitando o tema manual

  // ===== Elementos
  const inputCidade  = document.getElementById("cidade");
  const btn          = document.getElementById("btn");
  const divResultado = document.getElementById("resultado");
  const loader       = document.getElementById("loader");
  const msg          = document.getElementById("msg");
  const extrasCard   = document.getElementById("extras");
  const nascerEl     = document.getElementById("nascer");
  const porEl        = document.getElementById("por");
  const forecastCard = document.getElementById("forecast");
  const forecastGrid = document.getElementById("forecastGrid");
  const toggleTema   = document.getElementById("toggleTema");

  // ===== Tema (persistência + override manual com TTL)
  function aplicarTema(mode){
    // mode: "light" | "dark"
    document.body.classList.toggle("theme-light", mode === "light");
    localStorage.setItem(THEME_KEY, mode);
  }
  function setManualTheme(mode){
    aplicarTema(mode);
    localStorage.setItem(THEME_OVERRIDE_TS, Date.now().toString());
  }
  function manualThemeIsFresh(){
    const ts = Number(localStorage.getItem(THEME_OVERRIDE_TS) || 0);
    if (!ts) return false;
    const elapsedMin = (Date.now() - ts) / 60000;
    return elapsedMin <= THEME_OVERRIDE_TTL_MIN;
  }
  function aplicarTemaAutoIfAllowed(isDay){
    // Só aplica auto se o usuário não tiver trocado manualmente há pouco
    if (!manualThemeIsFresh()) {
      aplicarTema(isDay ? "light" : "dark");
    }
  }

  // Aplica tema salvo ao carregar
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme) aplicarTema(savedTheme);

  // Toggle manual (salva timestamp para TTL)
  toggleTema.addEventListener("click", () => {
    const novo = document.body.classList.contains("theme-light") ? "dark" : "light";
    setManualTheme(novo);
  });

  // ===== Eventos
  btn.addEventListener("click", () => buscarClima());
  inputCidade.addEventListener("keyup", (e) => { if (e.key === "Enter") buscarClima(); });

  // Última cidade salva → busca automática
  const ultima = localStorage.getItem("ultimaCidade");
  if (ultima) {
    inputCidade.value = ultima;
    buscarClima(ultima);
  }

  // ===== UI helpers
  function setLoading(isLoading){
    if (isLoading) {
      loader.classList.remove("hidden");
      btn.disabled = true;
      btn.textContent = "Buscando...";
      btn.setAttribute("aria-busy","true");
    } else {
      loader.classList.add("hidden");
      btn.disabled = false;
      btn.textContent = "Buscar";
      btn.removeAttribute("aria-busy");
    }
  }
  function showMsg(texto, tipo="err"){ // 'err' | 'ok'
    msg.textContent = texto;
    msg.classList.remove("hidden","ok");
    if (tipo==="ok") msg.classList.add("ok");
  }
  function hideMsg(){ msg.classList.add("hidden"); msg.classList.remove("ok"); msg.textContent=""; }

  // ===== Helpers de dados
  function formatTimeFromTZ(unixSeconds, tzOffsetSeconds){
    const d = new Date((unixSeconds + tzOffsetSeconds) * 1000);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
  }
  function setBackgroundClass(main, isDay = true) {
    const body = document.body;
    body.classList.remove(
      "weather-clear-day","weather-clear-night","weather-clouds","weather-rain",
      "weather-drizzle","weather-thunderstorm","weather-snow","weather-mist","weather-default"
    );
    switch ((main||"").toLowerCase()) {
      case "clear":       body.classList.add(isDay ? "weather-clear-day" : "weather-clear-night"); break;
      case "clouds":      body.classList.add("weather-clouds"); break;
      case "rain":        body.classList.add("weather-rain"); break;
      case "drizzle":     body.classList.add("weather-drizzle"); break;
      case "thunderstorm":body.classList.add("weather-thunderstorm"); break;
      case "snow":        body.classList.add("weather-snow"); break;
      case "mist":
      case "haze":
      case "fog":
      case "smoke":       body.classList.add("weather-mist"); break;
      default:            body.classList.add("weather-default");
    }
  }

  // ===== Parser de entrada: aceita "Cidade,PAIS" (2 letras) ou cai em ",BR"
  function montarQueryCidade(entrada){
    const raw = String(entrada || "").trim();
    if (!raw) return null;

    const partes = raw.split(",");
    if (partes.length >= 2) {
      const cidade = partes[0].trim();
      const pais   = partes[1].trim().toUpperCase(); // aceita "pt", "PT", " pt  "
      if (/^[A-Z]{2}$/.test(pais)) {
        return `${cidade},${pais}`;
      }
      // se país inválido, cai no padrão BR
      return `${cidade},BR`;
    }
    // sem país → BR por padrão
    return `${raw},BR`;
  }

  // ===== Busca clima atual + extras
  async function buscarClima(cidadeFromBtn = null) {
    const entradaOrig = (typeof cidadeFromBtn === "string") ? cidadeFromBtn : inputCidade.value;
    const query = montarQueryCidade(entradaOrig);
    if (!query) { showMsg("Digite uma cidade."); return; }

    hideMsg();
    divResultado.innerHTML = "";
    extrasCard.classList.add("hidden");
    forecastCard.classList.add("hidden");
    setLoading(true);

    const q = encodeURIComponent(query);
    const urlNow = `https://api.openweathermap.org/data/2.5/weather?q=${q}&appid=${API_KEY}&lang=pt_br&units=metric`;

    try {
      const res = await fetch(urlNow);
      const dados = await res.json();

      if (!res.ok) {
        setBackgroundClass("default");
        showMsg(`Erro: ${dados?.message || res.status}`);
        return;
      }

      // Clima atual
      const icone = dados.weather?.[0]?.icon || "01d";         
      const urlIcone = `https://openweathermap.org/img/wn/${icone}@2x.png`;
      const isDay = icone.endsWith("d");
      const main = (dados.weather?.[0]?.main || "").toLowerCase();
      const ventoKmH = Math.round((dados.wind?.speed || 0) * 3.6);

      // Tema automático (respeita override manual recente)
      aplicarTemaAutoIfAllowed(isDay);

      divResultado.innerHTML = `
        <h2>${dados.name}</h2>
        <img src="${urlIcone}" alt="Ícone do clima" />
        <p>🌡️ Temperatura: ${Math.round(dados.main.temp)}°C</p>
        <p>🌡️ Sensação térmica: ${Math.round(dados.main.feels_like)}°C</p>
        <p>🔽 Mínima: ${Math.round(dados.main.temp_min)}°C | 🔼 Máxima: ${Math.round(dados.main.temp_max)}°C</p>
        <p>☁️ Clima: ${dados.weather[0].description}</p>
        <p>💧 Umidade: ${dados.main.humidity}%</p>
        <p>🌬️ Vento: ${ventoKmH} km/h</p>
      `;
      setBackgroundClass(main, isDay);

      // Nascer/pôr do sol (horário local da cidade)
      const tz = dados.timezone || 0; // em segundos
      const nascer = formatTimeFromTZ(dados.sys.sunrise, tz);
      const por    = formatTimeFromTZ(dados.sys.sunset,  tz);
      nascerEl.textContent = nascer;
      porEl.textContent    = por;
      extrasCard.classList.remove("hidden");

      // Salva última cidade (sem país extra — salva como digitou)
      localStorage.setItem("ultimaCidade", String(entradaOrig || "").trim());

      // Previsão 5 dias
      await carregarPrevisao(query);

    } catch (erro) {
      showMsg("Erro de rede: " + erro.message);
      setBackgroundClass("default");
    } finally {
      setLoading(false);
    }
  }

  async function carregarPrevisao(query){
    const q = encodeURIComponent(query);
    const urlForecast = `https://api.openweathermap.org/data/2.5/forecast?q=${q}&appid=${API_KEY}&lang=pt_br&units=metric`;
    forecastGrid.innerHTML = "";
    forecastCard.classList.add("hidden");

    try{
      const res = await fetch(urlForecast);
      const data = await res.json();
      if (!res.ok) { showMsg(`Erro na previsão: ${data?.message || res.status}`); return; }

      // Agrupa por data (AAAA-MM-DD)
      const byDay = {};
      data.list.forEach(item => {
        const date = new Date(item.dt * 1000);
        const dayKey = date.toISOString().slice(0,10);
        if (!byDay[dayKey]) byDay[dayKey] = [];
        byDay[dayKey].push(item);
      });

      // Pega 5 dias (inclui hoje)
      const days = Object.keys(byDay).slice(0,5);

      days.forEach(dayKey => {
        const items = byDay[dayKey];
        let min = +Infinity, max = -Infinity;
        const noon = items.find(i => i.dt_txt.includes("12:00:00")) || items[0];
        const icon = noon.weather?.[0]?.icon || "01d";

        items.forEach(i => {
          min = Math.min(min, i.main.temp_min);
          max = Math.max(max, i.main.temp_max);
        });

        const [yyyy,mm,dd] = dayKey.split("-");
        const label = `${dd}/${mm}`;

        const el = document.createElement("div");
        el.className = "day";
        el.innerHTML = `
          <div class="date">${label}</div>
          <img src="https://openweathermap.org/img/wn/${icon}.png" alt="">
          <div class="range">🔽 ${Math.round(min)}°C | 🔼 ${Math.round(max)}°C</div>
        `;
        forecastGrid.appendChild(el);
      });

      forecastCard.classList.remove("hidden");
      hideMsg();
    }catch(err){
      showMsg("Erro na previsão: " + err.message);
    }
  }
});


// Lista de activos que se muestran por defecto.
// id = símbolo de Yahoo Finance. newsQuery = texto con el que se buscan sus noticias.

export const CATS = [
  { id: "idx", name: "Índices" },
  { id: "acc", name: "Acciones" },
  { id: "mat", name: "Materias primas" },
  { id: "cri", name: "Cripto" },
  { id: "div", name: "Divisas" },
  { id: "mine", name: "Mi lista" }
];

export const ASSETS = [
  { id: "^GSPC", short: "SPX", name: "S&P 500", cat: "idx", newsQuery: "S&P 500" },
  { id: "^IBEX", short: "IBEX", name: "IBEX 35", cat: "idx", newsQuery: "IBEX 35" },
  { id: "^NDX", short: "NDX", name: "Nasdaq 100", cat: "idx", newsQuery: "Nasdaq 100" },
  { id: "^STOXX50E", short: "SX5E", name: "Euro Stoxx 50", cat: "idx", newsQuery: "Euro Stoxx 50" },
  { id: "NVDA", short: "NVDA", name: "Nvidia", cat: "acc", newsQuery: "Nvidia" },
  { id: "AAPL", short: "AAPL", name: "Apple", cat: "acc", newsQuery: "Apple acciones" },
  { id: "MSFT", short: "MSFT", name: "Microsoft", cat: "acc", newsQuery: "Microsoft acciones" },
  { id: "TSLA", short: "TSLA", name: "Tesla", cat: "acc", newsQuery: "Tesla acciones" },
  { id: "ITX.MC", short: "ITX", name: "Inditex", cat: "acc", newsQuery: "Inditex" },
  { id: "SAN.MC", short: "SAN", name: "Banco Santander", cat: "acc", newsQuery: "Banco Santander" },
  { id: "IBE.MC", short: "IBE", name: "Iberdrola", cat: "acc", newsQuery: "Iberdrola" },
  { id: "GC=F", short: "XAU", name: "Oro", cat: "mat", newsQuery: "precio del oro" },
  { id: "SI=F", short: "XAG", name: "Plata", cat: "mat", newsQuery: "precio de la plata" },
  { id: "BZ=F", short: "BRENT", name: "Petróleo Brent", cat: "mat", newsQuery: "petróleo Brent" },
  { id: "NG=F", short: "NG", name: "Gas natural", cat: "mat", newsQuery: "gas natural precio" },
  { id: "BTC-USD", short: "BTC", name: "Bitcoin", cat: "cri", newsQuery: "Bitcoin" },
  { id: "ETH-USD", short: "ETH", name: "Ethereum", cat: "cri", newsQuery: "Ethereum" },
  { id: "EURUSD=X", short: "EUR/USD", name: "Euro / Dólar", cat: "div", newsQuery: "euro dólar" }
];

// Noticias generales de mercado que se pasan al asistente
export const GENERAL_NEWS_QUERIES = ["bolsa mercados hoy", "Wall Street bolsa", "Banco Central Europeo Reserva Federal tipos"];

// Un símbolo válido: letras, números y . - = ^ (máximo 15 caracteres)
export const SYMBOL_RE = /^[A-Za-z0-9.\-=^]{1,15}$/;

export function findAsset(symbol) {
  return ASSETS.find((a) => a.id === symbol) || null;
}

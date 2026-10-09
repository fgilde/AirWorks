import type { AppDefinition, SearchHit } from '../index';

type Ratio = {
  id: string;
  name: string;
  subgroup?: string;
  top: string;
  bottom: string;
  factor?: number;
  unit?: string;
  sample: [number, number];
  range?: [number, number];
  description: string;
  more?: string;
};
type Group = { name: string; icon: string; color: string; ratios: Ratio[] };

const groups: Group[] = [
  {
    name: 'Liquidity', icon: 'ratio-cash.png', color: '#00777a', ratios: [
      { id: 'cash-ratio', name: 'Cash ratio', subgroup: 'Liquidity level 1', top: 'Cash and cash equivalents', bottom: 'Current liabilities', factor: 100, unit: '%', sample: [180, 950], range: [10, 30], description: 'Share of short-term debt that can be paid immediately from available cash.', more: 'Much higher values point to idle money that earns little, much lower values to dependency on incoming payments.' },
      { id: 'quick-ratio', name: 'Quick ratio', subgroup: 'Liquidity level 2', top: 'Cash + short-term receivables', bottom: 'Current liabilities', factor: 100, unit: '%', sample: [1020, 950], range: [100, 150], description: 'Adds receivables that turn into cash soon. At least 100 % is the usual target.' },
      { id: 'current-ratio', name: 'Current ratio', subgroup: 'Liquidity level 3', top: 'Current assets', bottom: 'Current liabilities', factor: 100, unit: '%', sample: [1840, 950], range: [150, 250], description: 'Compares all current assets including inventory with short-term debt.', more: 'The classic rule of thumb asks for 200 %. Inventory that sells slowly makes the ratio look better than the real ability to pay.' },
    ],
  },
  {
    name: 'Profitability', icon: 'ratio-graph.png', color: '#537b35', ratios: [
      { id: 'return-on-equity', name: 'Return on equity', top: 'Net income', bottom: 'Average equity', factor: 100, unit: '%', sample: [420, 3100], range: [10, 25], description: 'How well the owners\' capital earns money.', more: 'Compare it with a risk-free investment plus a risk premium. A high return on equity together with a low equity ratio usually means high leverage.' },
      { id: 'return-on-assets', name: 'Return on assets', top: 'Net income + interest expense', bottom: 'Total capital', factor: 100, unit: '%', sample: [510, 8600], range: [5, 12], description: 'Return on all capital employed, independent of how it is financed.' },
      { id: 'ebit-margin', name: 'EBIT margin', subgroup: 'Operating profitability', top: 'EBIT', bottom: 'Revenue', factor: 100, unit: '%', sample: [1250, 12480], range: [8, 20], description: 'Share of revenue that remains as operating profit before interest and taxes.' },
    ],
  },
  {
    name: 'Capital structure', icon: 'icon-balancesheet.png', color: '#35496b', ratios: [
      { id: 'equity-ratio', name: 'Equity ratio', top: 'Equity', bottom: 'Total capital', factor: 100, unit: '%', sample: [3100, 8600], range: [30, 50], description: 'Share of the balance sheet financed by the owners. Higher values mean more independence from lenders.' },
      { id: 'debt-to-equity', name: 'Debt to equity', subgroup: 'Leverage', top: 'Liabilities', bottom: 'Equity', sample: [5500, 3100], range: [0.5, 2], description: 'Units of debt standing against one unit of equity.' },
      { id: 'asset-coverage', name: 'Fixed asset coverage', subgroup: 'Golden balance sheet rule', top: 'Equity + long-term liabilities', bottom: 'Fixed assets', factor: 100, unit: '%', sample: [6200, 5100], range: [100, 150], description: 'Long-term assets should be financed long-term. Values below 100 % are a warning sign.' },
    ],
  },
  {
    name: 'Sales', icon: 'ratio-shoppingCart.png', color: '#d15c27', ratios: [
      { id: 'revenue-growth', name: 'Revenue growth', top: 'Revenue − revenue of prior year', bottom: 'Revenue of prior year', factor: 100, unit: '%', sample: [860, 11620], range: [3, 15], description: 'Relative change of revenue compared with the previous year.' },
      { id: 'days-sales-outstanding', name: 'Days sales outstanding', subgroup: 'Receivables', top: 'Trade receivables', bottom: 'Revenue', factor: 365, unit: 'days', sample: [1400, 12480], range: [30, 60], description: 'Average number of days customers take to pay.' },
    ],
  },
  {
    name: 'Inventory', icon: 'ratio-product.png', color: '#8d4085', ratios: [
      { id: 'inventory-turnover', name: 'Inventory turnover', top: 'Cost of goods sold', bottom: 'Average inventory', sample: [7400, 1100], range: [4, 10], description: 'How often the inventory is sold and replaced within a year.' },
      { id: 'days-inventory', name: 'Days inventory outstanding', top: 'Average inventory', bottom: 'Cost of goods sold', factor: 365, unit: 'days', sample: [1100, 7400], range: [30, 90], description: 'Average number of days goods stay in stock.' },
    ],
  },
  {
    name: 'Personnel', icon: 'ratio-personal.png', color: '#a2273b', ratios: [
      { id: 'revenue-per-employee', name: 'Revenue per employee', top: 'Revenue', bottom: 'Average number of employees', unit: 'k', sample: [12480, 64], range: [150, 300], description: 'Productivity indicator; compare only within the same industry.' },
      { id: 'personnel-cost-ratio', name: 'Personnel cost ratio', top: 'Personnel expenses', bottom: 'Revenue', factor: 100, unit: '%', sample: [3900, 12480], range: [20, 35], description: 'Share of revenue spent on wages, salaries and social security.' },
    ],
  },
];

const all = groups.flatMap((group) => group.ratios.map((ratio) => ({ group, ratio })));
const escape = (value: string) => value.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`);
const format = (value: number) => Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: Math.abs(value) < 10 ? 2 : 1 }) : '–';

const search = (query: string): SearchHit[] => all
  .filter(({ group, ratio }) => [ratio.name, ratio.subgroup, ratio.top, ratio.bottom, group.name].some((text) => text?.toLowerCase().includes(query)))
  .map(({ group, ratio }) => ({ title: ratio.name, description: `Key ratios · ${group.name}`, icon: group.icon, intent: { ratio: ratio.id } }));

export const keyRatiosApp = (asset: (name: string) => string): AppDefinition => ({
  id: 'key-ratios',
  title: 'Key ratios',
  icon: 'icon-percent.png',
  accent: '#537b35',
  width: 980,
  height: 640,
  search,
  render: ({ host, intent, onIntent }) => {
    let current = all.find(({ ratio }) => ratio.id === intent?.ratio) ?? all[0];
    let query = '';
    let extended = false;
    let values = [...current.ratio.sample];

    host.innerHTML = '<div class="key-ratios"><aside><label class="kr-search"><input type="search" placeholder="Search key ratios …" /></label><nav></nav></aside><article></article></div>';
    const nav = host.querySelector('nav')!;
    const details = host.querySelector('article')!;

    const select = (id: string) => {
      current = all.find(({ ratio }) => ratio.id === id) ?? current;
      values = [...current.ratio.sample];
      extended = false;
      renderList();
      renderDetails();
    };

    const renderList = () => {
      nav.innerHTML = groups.map((group) => {
        const ratios = group.ratios.filter((ratio) => !query || [ratio.name, ratio.subgroup, group.name].some((text) => text?.toLowerCase().includes(query)));
        if (!ratios.length) return '';
        return `<section style="--group:${group.color}"><h3><span class="kr-chip"><img src="${asset(group.icon)}" alt="" /></span>${escape(group.name)}<small>${ratios.length}</small></h3>
          ${ratios.map((ratio) => `<button class="${ratio === current.ratio ? 'selected' : ''}" data-ratio="${ratio.id}"><strong>${escape(ratio.name)}</strong>${ratio.subgroup ? `<small>${escape(ratio.subgroup)}</small>` : ''}</button>`).join('')}</section>`;
      }).join('') || '<p class="kr-empty">No key ratio found.</p>';
      nav.querySelectorAll<HTMLElement>('[data-ratio]').forEach((button) => button.addEventListener('click', () => select(button.dataset.ratio!)));
    };

    const result = () => {
      const { factor = 1 } = current.ratio;
      return values[1] ? values[0] / values[1] * factor : NaN;
    };

    const gauge = () => {
      const range = current.ratio.range;
      if (!range) return '';
      const max = range[1] * 2;
      const position = Math.max(0, Math.min(100, result() / max * 100));
      return `<div class="kr-gauge"><div class="kr-gauge-bar"><span class="kr-gauge-good" style="left:${range[0] / max * 100}%;width:${(range[1] - range[0]) / max * 100}%"></span><i style="left:${position}%"></i></div>
        <div class="kr-gauge-labels"><span>0</span><span>Target ${format(range[0])} – ${format(range[1])} ${escape(current.ratio.unit ?? '')}</span><span>${format(max)}</span></div></div>`;
    };

    const renderResult = () => {
      const value = result();
      const range = current.ratio.range;
      const state = !range || !Number.isFinite(value) ? '' : value < range[0] ? 'low' : value > range[1] ? 'high' : 'good';
      details.querySelector('.kr-result')!.innerHTML = `<output class="${state}">${format(value)}<small>${escape(current.ratio.unit ?? '')}</small></output>${gauge()}`;
    };

    const renderDetails = () => {
      const { group, ratio } = current;
      details.style.setProperty('--group', group.color);
      details.innerHTML = `<header><span class="kr-chip large"><img src="${asset(group.icon)}" alt="" /></span><div><small>${escape(group.name)}${ratio.subgroup ? ` · ${escape(ratio.subgroup)}` : ''}</small><h2>${escape(ratio.name)}</h2></div></header>
        <div class="kr-card kr-formula"><div class="kr-fraction"><label><span>${escape(ratio.top)}</span><input type="number" value="${values[0]}" data-index="0" /></label><label><span>${escape(ratio.bottom)}</span><input type="number" value="${values[1]}" data-index="1" /></label></div>
          ${ratio.factor ? `<span class="kr-factor">× ${ratio.factor}</span>` : ''}<span class="kr-equals">=</span><div class="kr-result"></div></div>
        <div class="kr-card kr-text"><p>${escape(extended && ratio.more ? ratio.more : ratio.description)}</p>${ratio.more ? `<button class="kr-more">${extended ? '← Back' : 'Read more →'}</button>` : ''}</div>`;
      details.querySelectorAll<HTMLInputElement>('input').forEach((input) => input.addEventListener('input', () => {
        values[Number(input.dataset.index)] = Number(input.value);
        renderResult();
      }));
      details.querySelector('.kr-more')?.addEventListener('click', () => { extended = !extended; renderDetails(); });
      renderResult();
    };

    host.querySelector('input')!.addEventListener('input', (event) => {
      query = (event.target as HTMLInputElement).value.trim().toLowerCase();
      renderList();
    });
    onIntent((next) => { if (next.ratio) select(next.ratio); });
    renderList();
    renderDetails();
  },
});

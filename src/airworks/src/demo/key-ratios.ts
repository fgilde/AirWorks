import type { AppDefinition } from '../index';

type Formula = { top: string; bottom: string; factor?: string };
type Ratio = { id: string; name: string; subgroup?: string; formula: Formula; description: string; more?: string };
type Group = { name: string; icon: string; ratios: Ratio[] };

const groups: Group[] = [
  {
    name: 'Liquidity', icon: 'ratio-cash.png', ratios: [
      { id: 'cash-ratio', name: 'Cash ratio', subgroup: 'Liquidity level 1', formula: { top: 'Cash and cash equivalents', bottom: 'Current liabilities', factor: '100 %' }, description: 'Shows which share of short-term debt can be paid immediately from available cash.', more: 'Values between 10 % and 30 % are common. Much higher values point to idle money that earns little, much lower values to dependency on incoming payments.' },
      { id: 'quick-ratio', name: 'Quick ratio', subgroup: 'Liquidity level 2', formula: { top: 'Cash + short-term receivables', bottom: 'Current liabilities', factor: '100 %' }, description: 'Adds receivables that turn into cash soon. A value of at least 100 % is the usual target.' },
      { id: 'current-ratio', name: 'Current ratio', subgroup: 'Liquidity level 3', formula: { top: 'Current assets', bottom: 'Current liabilities', factor: '100 %' }, description: 'Compares all current assets including inventory with short-term debt.', more: 'The classic rule of thumb asks for 200 %. Inventory that sells slowly makes the ratio look better than the real ability to pay.' },
    ],
  },
  {
    name: 'Profitability', icon: 'ratio-graph.png', ratios: [
      { id: 'return-on-equity', name: 'Return on equity', formula: { top: 'Net income', bottom: 'Average equity', factor: '100 %' }, description: 'Measures how well the owners\' capital earns money.', more: 'Compare it with the return of a risk-free investment plus a risk premium. A high return on equity together with a low equity ratio usually means high leverage.' },
      { id: 'return-on-assets', name: 'Return on assets', formula: { top: 'Net income + interest expense', bottom: 'Total capital', factor: '100 %' }, description: 'Shows the return on all capital employed, independent of how it is financed.' },
      { id: 'ebit-margin', name: 'EBIT margin', subgroup: 'Operating profitability', formula: { top: 'EBIT', bottom: 'Revenue', factor: '100 %' }, description: 'Share of revenue that remains as operating profit before interest and taxes.' },
    ],
  },
  {
    name: 'Capital structure', icon: 'icon-balancesheet.png', ratios: [
      { id: 'equity-ratio', name: 'Equity ratio', formula: { top: 'Equity', bottom: 'Total capital', factor: '100 %' }, description: 'Share of the balance sheet total financed by the owners. Higher values mean more independence from lenders.' },
      { id: 'debt-to-equity', name: 'Debt to equity', subgroup: 'Leverage', formula: { top: 'Liabilities', bottom: 'Equity' }, description: 'How many units of debt stand against one unit of equity.' },
      { id: 'asset-coverage', name: 'Fixed asset coverage', subgroup: 'Golden balance sheet rule', formula: { top: 'Equity + long-term liabilities', bottom: 'Fixed assets', factor: '100 %' }, description: 'Long-term assets should be financed long-term. Values below 100 % are a warning sign.' },
    ],
  },
  {
    name: 'Sales', icon: 'ratio-shoppingCart.png', ratios: [
      { id: 'revenue-growth', name: 'Revenue growth', formula: { top: 'Revenue − revenue of prior year', bottom: 'Revenue of prior year', factor: '100 %' }, description: 'Relative change of revenue compared with the previous year.' },
      { id: 'days-sales-outstanding', name: 'Days sales outstanding', subgroup: 'Receivables', formula: { top: 'Trade receivables', bottom: 'Revenue', factor: '365 days' }, description: 'Average number of days customers take to pay.' },
    ],
  },
  {
    name: 'Inventory', icon: 'ratio-product.png', ratios: [
      { id: 'inventory-turnover', name: 'Inventory turnover', formula: { top: 'Cost of goods sold', bottom: 'Average inventory' }, description: 'How often the inventory is sold and replaced within a year.' },
      { id: 'days-inventory', name: 'Days inventory outstanding', formula: { top: 'Average inventory', bottom: 'Cost of goods sold', factor: '365 days' }, description: 'Average number of days goods stay in stock.' },
    ],
  },
  {
    name: 'Personnel', icon: 'ratio-personal.png', ratios: [
      { id: 'revenue-per-employee', name: 'Revenue per employee', formula: { top: 'Revenue', bottom: 'Average number of employees' }, description: 'Productivity indicator; compare only within the same industry.' },
      { id: 'personnel-cost-ratio', name: 'Personnel cost ratio', formula: { top: 'Personnel expenses', bottom: 'Revenue', factor: '100 %' }, description: 'Share of revenue spent on wages, salaries and social security.' },
    ],
  },
];

const escape = (value: string) => value.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`);

const formula = ({ top, bottom, factor }: Formula) =>
  `<div class="kr-formula"><span class="kr-fraction"><span>${escape(top)}</span><span>${escape(bottom)}</span></span>${factor ? `<span class="kr-factor">× ${escape(factor)}</span>` : ''}</div>`;

export const keyRatiosApp = (asset: (name: string) => string): AppDefinition => ({
  id: 'key-ratios',
  title: 'Key ratios',
  icon: 'icon-percent.png',
  accent: '#537b35',
  width: 950,
  height: 600,
  render: ({ host }) => {
    let expanded = groups[0].name;
    let selected = groups[0].ratios[0];
    let query = '';

    host.innerHTML = `<div class="key-ratios"><aside><input type="search" placeholder="Search key ratios …" /><ul></ul></aside><article></article></div>`;
    const list = host.querySelector('ul')!;
    const details = host.querySelector('article')!;

    const matches = (ratio: Ratio, group: Group) =>
      !query || [ratio.name, ratio.subgroup, group.name].some((text) => text?.toLowerCase().includes(query));

    const renderList = () => {
      list.innerHTML = groups.map((group) => {
        const ratios = group.ratios.filter((ratio) => matches(ratio, group));
        if (!ratios.length) return '';
        const open = Boolean(query) || group.name === expanded;
        return `<li class="${open ? 'open' : ''}"><button class="kr-group" data-group="${escape(group.name)}"><img src="${asset(group.icon)}" alt="" /><span>${escape(group.name)}</span></button>
          <ul>${ratios.map((ratio) => `<li><button class="kr-ratio ${ratio === selected ? 'selected' : ''}" data-ratio="${ratio.id}"><strong>${escape(ratio.name)}</strong>${ratio.subgroup ? `<small>${escape(ratio.subgroup)}</small>` : ''}</button></li>`).join('')}</ul></li>`;
      }).join('');
      list.querySelectorAll<HTMLElement>('[data-group]').forEach((button) => button.addEventListener('click', () => {
        expanded = expanded === button.dataset.group ? '' : button.dataset.group!;
        renderList();
      }));
      list.querySelectorAll<HTMLElement>('[data-ratio]').forEach((button) => button.addEventListener('click', () => {
        selected = groups.flatMap((group) => group.ratios).find((ratio) => ratio.id === button.dataset.ratio)!;
        renderList();
        renderDetails();
      }));
    };

    const renderDetails = () => {
      details.innerHTML = `<h2>${escape(selected.name)}</h2>${selected.subgroup ? `<p class="kr-subgroup">(${escape(selected.subgroup)})</p>` : ''}
        <div class="kr-body">${formula(selected.formula)}<div class="kr-text"><p>${escape(selected.description)}</p></div>
        <nav>${selected.more ? '<button class="kr-back" hidden>Back</button><button class="kr-more">Read more</button>' : ''}</nav></div>`;
      const text = details.querySelector<HTMLElement>('.kr-text')!;
      const slide = (content: string, forward: boolean) => {
        text.classList.add(forward ? 'out-left' : 'out-right');
        setTimeout(() => {
          text.innerHTML = `<p>${escape(content)}</p>`;
          text.classList.remove('out-left', 'out-right');
        }, 200);
        details.querySelector<HTMLElement>('.kr-back')!.hidden = !forward;
        details.querySelector<HTMLElement>('.kr-more')!.hidden = forward;
      };
      details.querySelector('.kr-more')?.addEventListener('click', () => slide(selected.more!, true));
      details.querySelector('.kr-back')?.addEventListener('click', () => slide(selected.description, false));
    };

    host.querySelector('input')!.addEventListener('input', (event) => {
      query = (event.target as HTMLInputElement).value.trim().toLowerCase();
      renderList();
    });
    renderList();
    renderDetails();
  },
});

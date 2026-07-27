// One detail line inside a chart tooltip
export type TipRow = { label: string; value: string; color?: string };
// Tooltip contents for a single chart element, note is an optional explainer line
export type TipData = { title: string; color?: string; note?: string; rows: TipRow[] };
// One interactive legend entry: series key, swatch, optional total and short explainer
export type LegendItem = {
	key: string;
	label: string;
	color: string;
	total?: number;
	hint?: string;
};

// A chart datum, rows override the default tooltip detail when present
export type Slice = {
	label: string;
	value: number;
	color?: string;
	icon?: string;
	rows?: TipRow[];
};
// One scatter dot: x/y plot position, r drives the dot size, rows feed the tooltip
export type ScatterPoint = {
	label: string;
	x: number;
	y: number;
	r: number;
	color?: string;
	rows?: TipRow[];
};

// One coloured series in a stacked bar, keyed to a StackBar's values
export type StackSeries = { key: string; label: string; color: string; hint?: string };
// One stacked bar: a value per series key, plus the column total
export type StackBar = { label: string; values: Record<string, number>; total: number };

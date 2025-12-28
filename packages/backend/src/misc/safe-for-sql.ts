export function safeForSql(text: string): boolean {
	return !/[\0\n\r"'\\%]/g.test(text);
}

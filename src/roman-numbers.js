// replaces roman numbers with decimal

function romanToDecimal(str) {
    const romanMap = {I:1, V:5, X:10, L:50, C:100, D:500, M:1000};
    let num = 0, prev = 0;
    for (let i = str.length -1; i >=0; i--) {
        const curr = romanMap[str[i]];
        if (curr < prev) {
            num -= curr;
        } else {
            num += curr;
        }
        prev = curr;
    }
    return num;
}

export default function replaceRomanNumerals(text) {
    const regex = /\b(M{0,3})(CM|CD|D?C{0,3})?(XC|XL|L?X{0,3})?(IX|IV|V?I{0,3})\b/g;

    return text.replace(regex, match => {
        if (!match) return match;  // skip empty matches
        
        if (!/^[MDCLXVI]+$/.test(match)) return match;
        const decimal = romanToDecimal(match);
        return decimal;
    });
}
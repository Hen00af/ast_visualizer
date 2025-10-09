class Parser {
  constructor(input) {
    this.tokens = this.tokenize(input);
    this.pos = 0;
  }

  tokenize(input) {
    const tokens = [];
    let i = 0;
    while (i < input.length) {
      if (/\s/.test(input[i])) { i++; continue; }
      if (input[i] === '(' || input[i] === ')') tokens.push({ type: input[i], value: input[i++] });
      else if (input[i] === '&' && input[i+1] === '&') { tokens.push({ type: '&&', value: '&&' }); i+=2; }
      else if (input[i] === '|' && input[i+1] === '|') { tokens.push({ type: '||', value: '||' }); i+=2; }
      else if (input[i] === '|') tokens.push({ type: '|', value: input[i++] });
      else if (input[i] === '>' && input[i+1] === '>') { tokens.push({ type: '>>', value: '>>' }); i+=2; }
      else if (input[i] === '<' && input[i+1] === '<') { tokens.push({ type: '<<', value: '<<' }); i+=2; }
      else if (input[i] === '>' || input[i] === '<') tokens.push({ type: input[i], value: input[i++] });
      else {
        let word = '', inQuote = null;
        while (i < input.length) {
          if (!inQuote && /[\s()&|><]/.test(input[i])) break;
          if ((input[i] === '"' || input[i] === "'") && !inQuote) inQuote = input[i];
          else if (input[i] === inQuote) inQuote = null;
          word += input[i++];
        }
        if (word) tokens.push({ type: 'WORD', value: word });
      }
    }
    return tokens;
  }

  peek() { return this.tokens[this.pos]; }
  consume(type) { const t = this.peek(); if (!t || (type && t.type !== type)) return null; this.pos++; return t; }

  parseS() { return { type: 'S', children: [this.parseAndOr()] }; }

  parseAndOr() {
    const pipeline = this.parsePipeline();
    const tail = this.parseAndOrTail();
    return tail ? { type: 'AND_OR', children: [pipeline, tail] } : { type: 'AND_OR', children: [pipeline] };
  }

  parseAndOrTail() {
    const t = this.peek(); if (!t) return null;
    if (t.type === '&&' || t.type === '||') {
      const op = this.consume(t.type);
      const pipeline = this.parsePipeline();
      const tail = this.parseAndOrTail();
      const children = tail ? [op, pipeline, tail] : [op, pipeline];
      return { type: 'AND_OR_TAIL', children };
    }
    return null;
  }

  parsePipeline() {
    const cmd = this.parseCommandOrSubshell();
    const tail = this.parsePipelineTail();
    return tail ? { type: 'PIPELINE', children: [cmd, tail] } : { type: 'PIPELINE', children: [cmd] };
  }

  parsePipelineTail() {
    const t = this.peek(); if (!t || t.type !== '|') return null;
    this.consume('|');
    const cmd = this.parseCommandOrSubshell();
    const tail = this.parsePipelineTail();
    const children = tail ? [{ type: '|', value: '|' }, cmd, tail] : [{ type: '|', value: '|' }, cmd];
    return { type: 'PIPELINE_TAIL', children };
  }

  parseCommandOrSubshell() { return this.peek()?.type === '(' ? this.parseSubshell() : this.parseCommand(); }

  parseCommand() {
    const simple = this.parseSimple();
    const redirList = this.parseRedirList();
    if (simple && redirList) return { type: 'COMMAND', children: [simple, redirList] };
    if (simple) return { type: 'COMMAND', children: [simple] };
    if (redirList) return { type: 'COMMAND', children: [redirList] };
    return { type: 'COMMAND', children: [] };
  }

  parseSimple() {
    const words = [];
    while (this.peek()?.type === 'WORD') words.push({ type: 'WORD', value: this.consume('WORD').value });
    return words.length ? { type: 'SIMPLE', children: words } : null;
  }

  parseRedirList() {
    const redir = this.parseRedir(); if (!redir) return null;
    const tail = this.parseRedirList();
    return tail ? { type: 'REDIR_LIST', children: [redir, tail] } : { type: 'REDIR_LIST', children: [redir] };
  }

  parseRedir() {
    const t = this.peek(); if (!t) return null;
    if (['<', '>', '>>', '<<'].includes(t.type)) {
      const op = this.consume(t.type);
      const word = this.consume('WORD');
      if (!word) return null;
      return { type: 'REDIR', children: [{ type: op.type, value: op.value }, { type: 'WORD', value: word.value }] };
    }
    return null;
  }

  parseSubshell() {
    this.consume('(');
    const andOr = this.parseAndOr();
    this.consume(')');
    return { type: 'SUBSHELL', children: [andOr] };
  }
}

function parseCommand(input) {
  const parser = new Parser(input);
  return parser.parseS();
}

const nodeColors = {
  "S": "#58a6ff", "AND_OR": "#238636", "AND_OR_TAIL": "#2ea043",
  "PIPELINE": "#1f6feb", "PIPELINE_TAIL": "#388bfd",
  "COMMAND": "#bc8cff", "SIMPLE": "#d29922", "REDIR_LIST": "#f85149",
  "REDIR": "#da3633", "SUBSHELL": "#8250df", "WORD": "#7d8590",
  "&&": "#238636", "||": "#da3633", "|": "#1f6feb",
  ">": "#f85149", ">>": "#f85149", "<": "#f85149", "<<": "#f85149"
};

function drawTree(ast) {
  const svg = d3.select("#tree");
  svg.selectAll("*").remove();
  if (!ast) return;

  const width = 1600, height = 800, margin = 40;
  const g = svg.append("g").attr("transform", `translate(${margin},${margin})`);
  const root = d3.hierarchy(ast);
  const treeLayout = d3.tree().size([width - margin * 2, height - margin * 2]);
  treeLayout(root);

  g.selectAll(".link")
    .data(root.links())
    .enter().append("path")
    .attr("class", "link")
    .attr("d", d3.linkVertical().x(d => d.x).y(d => d.y));

  const nodes = g.selectAll(".node")
    .data(root.descendants())
    .enter().append("g")
    .attr("class", "node")
    .attr("transform", d => `translate(${d.x},${d.y})`);

  nodes.append("circle")
    .attr("r", 25)
    .attr("fill", d => nodeColors[d.data.type] || "#6e7681")
    .attr("stroke", "#0d1117").attr("stroke-width", 3);

  nodes.append("text")
    .attr("dy", "0.35em").attr("text-anchor", "middle")
    .attr("fill", "white")
    .text(d => d.data.value || d.data.type);
}

document.getElementById("run").addEventListener("click", () => {
  const cmd = document.getElementById("cmd").value;
  if (!cmd) return;
  try { drawTree(parseCommand(cmd)); }
  catch (e) { alert("Parse error: " + e.message); }
});

document.getElementById("cmd").addEventListener("keypress", e => {
  if (e.key === "Enter") document.getElementById("run").click();
});

document.querySelectorAll(".example-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const cmd = btn.getAttribute("data-cmd");
    document.getElementById("cmd").value = cmd;
    document.getElementById("run").click();
  });
});

// Initial example
document.getElementById("cmd").value = "cat file.txt && (grep error || echo none) | wc -l";
document.getElementById("run").click();

// === Utility: find top-level operator ===
function findTopLevelOperator(input, ops) {
  let depth = 0;
  for (let i = 0; i < input.length; i++) {
    if (input[i] === "(") depth++;
    else if (input[i] === ")") depth--;
    else if (depth === 0) {
      for (const op of ops) {
        if (input.startsWith(op, i)) return { index: i, op };
      }
    }
  }
  return null;
}

// === Main Parser ===
function parseCommand(input) {
  input = input.trim();
  if (!input) return { type: "EMPTY" };

  const logic = findTopLevelOperator(input, ["||", "&&"]);
  if (logic) {
    const left = input.slice(0, logic.index);
    const right = input.slice(logic.index + logic.op.length);
    return {
      type: logic.op === "&&" ? "AND" : "OR",
      children: [parseCommand(left), parseCommand(right)]
    };
  }

  const pipe = findTopLevelOperator(input, ["|"]);
  if (pipe) {
    const left = input.slice(0, pipe.index);
    const right = input.slice(pipe.index + 1);
    return {
      type: "PIPE",
      children: [parseCommand(left), parseCommand(right)]
    };
  }

  if (input.startsWith("(") && input.endsWith(")")) {
    let depth = 0;
    let valid = true;
    for (let i = 0; i < input.length; i++) {
      if (input[i] === "(") depth++;
      else if (input[i] === ")") depth--;
      if (depth === 0 && i < input.length - 1) valid = false;
    }
    if (valid) {
      return { type: "SUBSHELL", children: [parseCommand(input.slice(1, -1))] };
    }
  }

  const redirMatch = input.match(/(.*?)(<|>|>>|<<)\s*(\S+)/);
  if (redirMatch) {
    return {
      type: "COMMAND",
      value: redirMatch[1].trim(),
      children: [{ type: "REDIR", value: `${redirMatch[2]} ${redirMatch[3]}` }]
    };
  }

  return { type: "COMMAND", value: input };
}

// === D3 Visualizer ===
function drawTree(ast) {
  const svg = d3.select("#tree");
  svg.selectAll("*").remove();

  const width = +svg.attr("width");
  const height = +svg.attr("height");

  const root = d3.hierarchy(ast);
  const tree = d3.tree().size([width - 100, height - 100]);
  const nodes = tree(root);

  svg.selectAll("line")
    .data(nodes.links())
    .enter()
    .append("line")
    .attr("x1", d => d.source.x + 50)
    .attr("y1", d => d.source.y + 50)
    .attr("x2", d => d.target.x + 50)
    .attr("y2", d => d.target.y + 50)
    .attr("stroke", "#555");

  svg.selectAll("circle")
    .data(nodes.descendants())
    .enter()
    .append("circle")
    .attr("cx", d => d.x + 50)
    .attr("cy", d => d.y + 50)
    .attr("r", 22)
    .attr("fill", d => {
      if (d.data.type === "AND" || d.data.type === "OR") return "#9b59b6";
      if (d.data.type === "PIPE") return "#e67e22";
      if (d.data.type === "SUBSHELL") return "#3498db";
      if (d.data.type === "COMMAND") return "#2ecc71";
      return "#238636";
    });

  svg.selectAll("text")
    .data(nodes.descendants())
    .enter()
    .append("text")
    .attr("x", d => d.x + 50)
    .attr("y", d => d.y + 55)
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .text(d => d.data.value || d.data.type);
}

// === Syntax Explanation ===
const SYNTAX_DOCS = {
  "&&": "Logical AND — run right command only if left succeeds.",
  "||": "Logical OR — run right command only if left fails.",
  "|": "Pipe — pass output of left command into input of right.",
  "<": "Redirect input — read from file instead of stdin.",
  ">": "Redirect output — overwrite file with command output.",
  ">>": "Append output — add output to end of file.",
  "<<": "Here-doc — use inline string as input.",
  "()": "Subshell — run commands in a new shell context."
};

function explainSyntax(cmd) {
  for (const [symbol, meaning] of Object.entries(SYNTAX_DOCS)) {
    if (cmd.includes(symbol)) return `${symbol} → ${meaning}`;
  }
  return "Type a command to visualize its syntax and AST structure.";
}

// === Live input listener ===
const inputEl = document.getElementById("cmd");
const syntaxEl = document.getElementById("syntax");

inputEl.addEventListener("input", () => {
  const cmd = inputEl.value;
  syntaxEl.textContent = explainSyntax(cmd);
  if (!cmd.trim()) return;
  const ast = parseCommand(cmd);
  drawTree(ast);
});

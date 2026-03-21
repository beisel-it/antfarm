/**
 * US-005: Wire projects bar into board layout — replace column with bar above board
 * Tests that the projects bar container is in the HTML body between header and board,
 * and that renderBoard() no longer references renderProjectsColumn() in the board.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startDashboard } from '../dist/server/dashboard.js';

const PORT = 14540;
let server: http.Server;
let baseUrl: string;

before(async () => {
  server = await startDashboard(PORT);
  baseUrl = `http://localhost:${PORT}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

async function getHtml(): Promise<string> {
  const res = await fetch(`${baseUrl}/`);
  return res.text();
}

test('index.html body contains projects-bar-container element', async () => {
  const html = await getHtml();
  assert.ok(html.includes('id="projects-bar-container"'), 'should have projects-bar-container div');
});

test('projects-bar-container is between header and board', async () => {
  const html = await getHtml();
  const headerEnd = html.indexOf('</header>');
  const barContainer = html.indexOf('id="projects-bar-container"');
  const boardStart = html.indexOf('class="board"');
  assert.ok(headerEnd !== -1, 'header closing tag should exist');
  assert.ok(barContainer !== -1, 'projects-bar-container should exist');
  assert.ok(boardStart !== -1, 'board element should exist');
  assert.ok(headerEnd < barContainer, 'projects-bar-container should be after </header>');
  assert.ok(barContainer < boardStart, 'projects-bar-container should be before .board');
});

test('renderProjectsBarInto function is present in HTML', async () => {
  const html = await getHtml();
  assert.ok(html.includes('renderProjectsBarInto'), 'should have renderProjectsBarInto function');
});

test('renderProjectsBarInto uses projects-bar-container', async () => {
  const html = await getHtml();
  // function sets projects-bar-container innerHTML
  assert.ok(html.includes("getElementById('projects-bar-container')") || html.includes('getElementById("projects-bar-container")'),
    'renderProjectsBarInto should reference projects-bar-container element');
});

test('renderBoard does not call renderProjectsColumn', async () => {
  const html = await getHtml();
  // Find renderBoard function body and check it doesn't call renderProjectsColumn
  const renderBoardIdx = html.indexOf('function renderBoard(');
  assert.ok(renderBoardIdx !== -1, 'renderBoard function should exist');
  // Get function body (until next function definition at same level)
  const boardFnBody = html.slice(renderBoardIdx, renderBoardIdx + 3000);
  // board.innerHTML line should not contain renderProjectsColumn
  const boardInnerHTMLLine = boardFnBody.match(/board\.innerHTML\s*=\s*[^;]+;/);
  assert.ok(boardInnerHTMLLine, 'board.innerHTML assignment should exist in renderBoard');
  assert.ok(!boardInnerHTMLLine[0].includes('renderProjectsColumn'),
    'board.innerHTML in renderBoard should not call renderProjectsColumn');
});

test('rerenderProjectsColumn now delegates to renderProjectsBarInto', async () => {
  const html = await getHtml();
  const rerenderIdx = html.indexOf('function rerenderProjectsColumn()');
  assert.ok(rerenderIdx !== -1, 'rerenderProjectsColumn should still exist');
  // Find the function body
  const fnBody = html.slice(rerenderIdx, rerenderIdx + 300);
  assert.ok(fnBody.includes('renderProjectsBarInto'), 'rerenderProjectsColumn should delegate to renderProjectsBarInto');
});

test('loadProjects calls renderProjectsBarInto after loading', async () => {
  const html = await getHtml();
  const loadProjectsIdx = html.indexOf('async function loadProjects()');
  assert.ok(loadProjectsIdx !== -1, 'loadProjects function should exist');
  const fnBody = html.slice(loadProjectsIdx, loadProjectsIdx + 400);
  assert.ok(fnBody.includes('renderProjectsBarInto'), 'loadProjects should call renderProjectsBarInto');
});

test('GET / HTML still contains loadProjects function reference', async () => {
  const html = await getHtml();
  assert.ok(html.includes('loadProjects'), 'should have loadProjects function reference');
});

test('projects-bar-container is outside .board flex row', async () => {
  const html = await getHtml();
  // Ensure the projects-bar-container is NOT inside the board div
  // The board div starts with <div class="board" id="board">
  const boardDivIdx = html.indexOf('class="board" id="board"');
  const barContainerIdx = html.indexOf('id="projects-bar-container"');
  assert.ok(boardDivIdx !== -1, '.board element should exist');
  assert.ok(barContainerIdx !== -1, 'projects-bar-container should exist');
  // projects-bar-container should come BEFORE the board div
  assert.ok(barContainerIdx < boardDivIdx, 'projects-bar-container should be before .board div');
});

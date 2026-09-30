/* Portfolio frontend: talks to the Express API (see server.js). No data is kept in the browser. */
(function () {
  'use strict';

  /* ---------- Elements ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var grid = $('project-grid');
  var message = $('project-message');
  var status = $('project-status');
  var adminTools = $('admin-tools');
  var adminBadge = $('admin-badge');
  var adminToggle = $('admin-toggle');
  var addBtn = $('open-add-project');

  var loginDialog = $('login-dialog');
  var loginForm = $('login-form');
  var loginError = $('login-error');

  var projectDialog = $('project-dialog');
  var projectForm = $('project-form');
  var formError = $('form-error');
  var fileInput = $('p-file');
  var fileHint = $('file-hint');
  var submitBtn = $('submit-project');

  var state = { admin: false, maxUploadMb: 10, projects: [] };

  /* ---------- API helper ---------- */
  function api(path, options) {
    return fetch(path, Object.assign({ credentials: 'same-origin' }, options))
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (!res.ok) {
            var err = new Error(body.error || 'Request failed (' + res.status + ').');
            err.status = res.status;
            throw err;
          }
          return body;
        });
      }, function () {
        throw new Error('Cannot reach the server. Check your connection and try again.');
      });
  }

  /* ---------- Small helpers ---------- */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;          // textContent only: stored text can never inject HTML
    return node;
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function formatDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function isHttpUrl(value) {
    try { var u = new URL(value); return u.protocol === 'https:' || u.protocol === 'http:'; }
    catch (e) { return false; }
  }

  function excelIcon() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.6');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5', 'M9 13h6M9 17h6M12 11v8']
      .forEach(function (d) {
        var p = document.createElementNS(ns, 'path');
        p.setAttribute('d', d);
        svg.appendChild(p);
      });
    return svg;
  }

  function announce(text) { status.textContent = text; }

  /* ---------- Rendering ---------- */
  function buildCard(p) {
    var card = el('article', 'project');
    card.dataset.id = p.id;

    var body = el('div', 'project-body');
    body.appendChild(el('h3', '', p.title));
    body.appendChild(el('p', 'project-date', 'Added ' + formatDate(p.createdAt)));
    body.appendChild(el('p', '', p.description));

    if (p.tags && p.tags.length) {
      var tags = el('ul', 'tags');
      tags.setAttribute('aria-label', 'Tags');
      p.tags.forEach(function (t) { tags.appendChild(el('li', '', t)); });
      body.appendChild(tags);
    }

    if (p.file) {
      var chip = el('div', 'file-chip');
      chip.appendChild(excelIcon());

      var info = el('div', 'file-info');
      info.appendChild(el('strong', '', p.file.name));
      info.appendChild(el('span', '', formatSize(p.file.size)));
      chip.appendChild(info);

      var dl = el('a', 'btn btn-ghost btn-sm', 'Download');
      dl.href = '/api/projects/' + encodeURIComponent(p.id) + '/download';
      dl.setAttribute('aria-label', 'Download ' + p.file.name);
      chip.appendChild(dl);
      body.appendChild(chip);
    }

    var links = el('div', 'project-links');
    if (p.link && isHttpUrl(p.link)) {
      var a = el('a', '', 'Project link');
      a.href = p.link;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.setAttribute('aria-label', p.title + ' project link');
      links.appendChild(a);
    }
    if (state.admin) {
      var del = el('button', 'project-remove', 'Delete');
      del.type = 'button';
      del.setAttribute('aria-label', 'Delete project ' + p.title);
      del.addEventListener('click', function () { deleteProject(p); });
      links.appendChild(del);
    }
    if (links.children.length) body.appendChild(links);

    card.appendChild(body);
    return card;
  }

  function showMessage(title, detail, isError) {
    message.className = 'empty-state' + (isError ? ' is-error' : '');
    message.replaceChildren(el('p', '', title), el('p', '', detail));
    message.hidden = false;
  }

  function render() {
    grid.replaceChildren();
    state.projects.forEach(function (p) { grid.appendChild(buildCard(p)); });

    if (state.projects.length) {
      message.hidden = true;
    } else if (state.admin) {
      showMessage('No projects yet.', 'Select Add project to publish your first one.');
    } else {
      showMessage('Projects are coming soon.', 'Check back shortly, or get in touch below.');
    }
  }

  function renderAdminUi() {
    adminTools.hidden = !state.admin;
    adminBadge.hidden = !state.admin;
    adminToggle.textContent = state.admin ? 'Sign out' : 'Admin sign in';
    fileHint.textContent = '(optional, .xlsx .xlsm .xls or .csv, up to ' + state.maxUploadMb + ' MB)';
  }

  /* ---------- Initial load ---------- */
  function load() {
    Promise.all([api('/api/session'), api('/api/projects')])
      .then(function (results) {
        state.admin = !!results[0].admin;
        if (results[0].maxUploadMb) state.maxUploadMb = results[0].maxUploadMb;
        state.projects = results[1].projects || [];
        renderAdminUi();
        render();
      })
      .catch(function (err) {
        renderAdminUi();
        showMessage('Projects could not be loaded.', err.message, true);
      });
  }

  /* ---------- Admin: sign in / out ---------- */
  adminToggle.addEventListener('click', function () {
    if (state.admin) {
      api('/api/logout', { method: 'POST' }).then(function () {
        state.admin = false;
        renderAdminUi();
        render();
        announce('Signed out.');
      }).catch(function (err) { announce(err.message); });
    } else {
      loginForm.reset();
      loginError.textContent = '';
      loginDialog.showModal();
      $('l-password').focus();
    }
  });

  $('login-cancel').addEventListener('click', function () { loginDialog.close(); });

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    loginError.textContent = '';
    var password = $('l-password').value;
    if (!password) { loginError.textContent = 'Enter the admin password.'; return; }

    api('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password })
    }).then(function () {
      state.admin = true;
      loginDialog.close();
      renderAdminUi();
      render();
      announce('Signed in as admin.');
    }).catch(function (err) {
      loginError.textContent = err.message;
      $('l-password').select();
    });
  });

  /* ---------- Admin: add project ---------- */
  addBtn.addEventListener('click', function () {
    projectForm.reset();
    formError.textContent = '';
    projectDialog.showModal();
    $('p-title').focus();
  });

  $('cancel-project').addEventListener('click', function () { projectDialog.close(); });

  projectForm.addEventListener('submit', function (e) {
    e.preventDefault();
    formError.textContent = '';

    var title = $('p-title').value.trim();
    var description = $('p-desc').value.trim();
    var link = $('p-link').value.trim();
    var file = fileInput.files && fileInput.files[0];

    if (!title || !description) {
      formError.textContent = 'Enter a project title and a description.';
      (title ? $('p-desc') : $('p-title')).focus();
      return;
    }
    if (link && !isHttpUrl(link)) {
      formError.textContent = 'The project link must start with http:// or https://.';
      $('p-link').focus();
      return;
    }
    if (file && file.size > state.maxUploadMb * 1024 * 1024) {
      formError.textContent = 'That file is larger than ' + state.maxUploadMb + ' MB.';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = file ? 'Uploading…' : 'Saving…';

    api('/api/projects', { method: 'POST', body: new FormData(projectForm) })
      .then(function (body) {
        state.projects.unshift(body.project);
        render();
        projectDialog.close();
        var card = grid.querySelector('[data-id="' + body.project.id + '"]');
        if (card) {
          card.classList.add('is-new');
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        announce('Saved project ' + body.project.title + '.');
      })
      .catch(function (err) {
        if (err.status === 401) {
          state.admin = false;
          renderAdminUi();
          render();
          projectDialog.close();
          announce('Your session expired. Sign in again.');
          return;
        }
        formError.textContent = err.message;
      })
      .then(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save project';
      });
  });

  /* ---------- Admin: delete ---------- */
  function deleteProject(p) {
    if (!window.confirm('Delete "' + p.title + '"? The attached file is deleted too.')) return;
    api('/api/projects/' + encodeURIComponent(p.id), { method: 'DELETE' })
      .then(function () {
        state.projects = state.projects.filter(function (x) { return x.id !== p.id; });
        render();
        announce('Deleted project ' + p.title + '.');
      })
      .catch(function (err) {
        if (err.status === 401) {
          state.admin = false;
          renderAdminUi();
          render();
        }
        announce(err.message);
      });
  }

  /* ---------- Dialog: close on backdrop click, restore focus ---------- */
  [loginDialog, projectDialog].forEach(function (dialog) {
    dialog.addEventListener('click', function (e) {
      var r = dialog.getBoundingClientRect();
      var inside = e.clientX >= r.left && e.clientX <= r.right &&
                   e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) dialog.close();
    });
  });
  loginDialog.addEventListener('close', function () { adminToggle.focus(); });
  projectDialog.addEventListener('close', function () { if (state.admin) addBtn.focus(); });

  load();
})();

/**
 * Shows a snackbar notification using BeerCSS.
 * @param {string} message - The message to display
 * @param {string} type - The type of notification ('success', 'error', 'info')
 * @private
 */
export function showSnackbar(message, type = 'info') {
  let snackbar = document.getElementById('cloudSnackbar');
  if (!snackbar) {
    snackbar = document.createElement('div');
    snackbar.id = 'cloudSnackbar';
    snackbar.className = 'snackbar large-text top';
    document.body.appendChild(snackbar);
  }

  const icon = document.createElement('i');
  icon.className = 'extra';
  icon.textContent = type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info';
  const span = document.createElement('span');
  span.textContent = message;
  snackbar.replaceChildren(icon, span);
  snackbar.classList.remove('error', 'success', 'info');
  snackbar.classList.add(type);

  ui('#cloudSnackbar', 3000);
}
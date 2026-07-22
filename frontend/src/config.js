const host = window.location.hostname;

export function getApiUrl(path = '') {
  return `http://${host}:3000/api${path}`;
}

export function getSocketUrl(namespace = '') {
  return `http://${host}:3000${namespace}`;
}

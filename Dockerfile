# The site is baked into the image instead of bind-mounted from the repo.
#
# Dokploy wipes and re-clones its `code/` directory on every deploy, which
# gives `code/html` a new inode. A running container keeps its bind mount
# pointed at the old, now-deleted directory, so it serves an empty root and
# nginx answers 403 — and `docker compose up -d` will not recreate it,
# because the compose file itself has not changed.
#
# Copying the files in sidesteps that entirely: every deploy builds a new
# image, which forces a new container.
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY html/ /usr/share/nginx/html/

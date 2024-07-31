frOM busybox as base
cOpy lint-other.Dockerfile .

froM busybox aS notused
COPY lint-other.Dockerfile .

from scratch
COPy --from=base \
  /lint-other.Dockerfile \
  /


# Setting SHELL to bash allows bash commands to be executed by recipes.
# Options are set to exit when a recipe line exits non-zero or a piped command fails.
SHELL = /usr/bin/env bash -o pipefail
.SHELLFLAGS = -ec

# 这个build 包含data migrate，后续会拆分开
build: 
	npm run build
# make run WHERE=local
run:
	./cmd/start.sh $(WHERE)

# make image WHERE=local FULL_IMAGE_NAME=duizhang/servicea
# image:
# 	docker build --build-arg WHERE=$(WHERE) -t $(FULL_IMAGE_NAME) .
#!/bin/bash

WHERE=${1}
# 1,在启动redis与postgresql
docker compose --file ./cmd/${WHERE}/docker-compose/docker-compose.yaml  --env-file  ./cmd/${WHERE}/docker-compose/docker-compose.env up -d
if [ ! $? -eq 0 ]; then 
    echo "启动redis或者postgresql失败...."
    exit 127
fi
# 2, 在项目的根目录生成.env文件
env_file="$(pwd)/.env"
if [ ! -e "${env_file}" ]; then
    cp -ap $(pwd)/cmd/${WHERE}/.env ${env_file}
else
    echo "WARNING !!! .env文件已经存在，请确保配置信息的正确性!!!"
fi

 # 3, 启动team evolve

 if [ $? -eq 0 ]; then
    npm run dev
 else
    echo "启动team evolve 失败!!!"
    exit 127
 fi
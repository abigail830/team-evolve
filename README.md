# team-evolve


## 技术备忘

```shell
## 新环境迁移数据库
npx prisma migrate deploy
```

```sql
-- neon 需要安装ventor插件 https://neon.tech/docs/extensions/pgvector
CREATE EXTENSION vector;
```

## Vercel部署指南

项目可以在Vercel上部署，但有一些依赖项需要特别注意：

### 解决`vm2`和`coffee-script`依赖问题

部署时可能会遇到以下错误：
```
Module not found: Can't resolve 'coffee-script' in '/vercel/path0/node_modules/vm2/lib'
```

**解决方案**：

1. 确保`coffeescript`包已添加到`dependencies`（不是`devDependencies`）：
   ```json
   "dependencies": {
     // 其他依赖...
     "coffeescript": "^2.7.0"
   }
   ```

2. 或者，设置环境变量`DISABLE_OSS=true`来使用模拟OSS实现。

### 配置环境变量

在Vercel项目设置中添加以下环境变量：

- `DISABLE_OSS=true`（如果不需要OSS功能）
- 其他必需的环境变量...

## 常用API

#### 术语查询
```shell
# 不带格式化的版本
curl "http://localhost:3000/api/glossary/search?domain=%E8%BF%B7%E5%A2%83"

# 带格式化输出的版本（domain="迷境"，推荐，更易读）
curl "http://localhost:3000/api/glossary/search?domain=%E8%BF%B7%E5%A2%83" | jq
```



## 本地启动Team Evolve

**本地环境：**MAC arm系列

**前置依赖：**安装了docker或者其他容器引擎、安装了docker-compose、MAC要联网（需要从docker hub获取镜像）、安装了cmake

以容器的方式启动redis与postgresql，数据分别被持久化到`/var/lib/docker/volumes/docker-compose_postgres_data`与`/var/lib/docker/volumes/docker-compose_postgres_data`中。

由于mac中的容器引擎都是运行在VM中的，所以`/var/lib/docker/volumes/`是vm中的路径，需要在mac中 先进入到容器引擎所在vm中才能看到redis与postgresql的数据文件。

**1，启动team evolve**

```shell
make build
sudo make run WHERE=local
```

**2， 初始化帐号信息**

```shell
# 在本地执行下面的命令，添加测试用帐号 admin ,密码为 teamevolve
docker exec docker-compose-postgres-1 psql -U evolve_user -d team_evolve -c "INSERT INTO \"User\" (id, email, name, password, role, \"createdAt\", \"updatedAt\") VALUES (gen_random_uuid(),'admin@team-evolve.com','admin','IUjFeVv_bBdLDRIfL5LF4kNoe2j1xrEyGhHDpY6na3zgd7b7zU8','ADMIN',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password,role = EXCLUDED.role,\"updatedAt\" = CURRENT_TIMESTAMP;"
```

**3，访问系统**

 浏览器打开 http://localhost:3000/  , 使用admin@team-evolve.com  / teamevolve登陆。

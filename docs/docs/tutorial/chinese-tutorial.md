# 1 汉化前准备
- 按照[官网教程](https://superset.apache.org/docs/installation/installing-superset-using-docker-compose)，使用docker安装好superset
- 安装成功后，会有几个容器：
```
# 查看容器数
sudo docker ps -a

显示如下几个容器：
superset_app、superset_cache、superset_init、
superset_worker、superset_worker_beat、superset_db
```

截图演示如下：
![docker容器截图演示](https://github.com/yangxifi/spark-study/blob/master/picture/superset-chinese-tutorial/docker%E5%AE%B9%E5%99%A8%E6%88%AA%E5%9B%BE%E6%BC%94%E7%A4%BA.png?raw=true)


# 2 汉化
1.进入容器superset_app
```
sudo docker exec -i -t superset_app /bin/bash
```

2.安装环境
```
1.更新软件源列表
apt update

2.安装软件包
apt-get install vim
apt-get install gettext
```

截图演示如下：
![进入容器.png](https://github.com/yangxifi/spark-study/blob/master/picture/superset-chinese-tutorial/%E8%BF%9B%E5%85%A5%E5%AE%B9%E5%99%A8.png?raw=true)
![安装环境.png](https://github.com/yangxifi/spark-study/blob/master/picture/superset-chinese-tutorial/%E5%AE%89%E8%A3%85%E7%8E%AF%E5%A2%83.png?raw=true)

3.编译语言包
```
1.进入语言包目录
cd /app/superset/translations/zh/LC_MESSAGES/

2.开始编译
msgfmt ./messages.po -o ./messages.mo

3.注意事项：编译过程，如果报错，如何解决
    报错1:
    ./messages.po:39: 'msgid' and 'msgstr' entries do not both begin with '\n'
    ./messages.po:398: 'msgid' and 'msgstr' entries do not both end with '\n'
    msgfmt: found 2 fatal errors

    解决方案：注释messages.po文件，39行、398行附近的内容（如果是报的其他行，则注释掉对应行的数据即可）,再重新编译就能成功

4.编译成功后，语言包目录会出现messages.mo文件，则表示编译成功了
```
截图演示如下：
![编译语言包.png](https://github.com/yangxifi/spark-study/blob/master/picture/superset-chinese-tutorial/%E7%BC%96%E8%AF%91%E8%AF%AD%E8%A8%80%E5%8C%85.png?raw=true)
![编译语言包成功演示.png](https://github.com/yangxifi/spark-study/blob/master/picture/superset-chinese-tutorial/%E7%BC%96%E8%AF%91%E8%AF%AD%E8%A8%80%E5%8C%85%E6%88%90%E5%8A%9F%E6%BC%94%E7%A4%BA.png?raw=true)


4.修改配置文件的语言配置
```
vim /app/docker/pythonpath_dev/superset_config.py

# 新增如下配置
BABEL_DEFAULT_LOCALE='zh'
BABEL_DEFAULT_FOLDER='superset/translations'
# 这儿是可选的多种语言
LANGUAGES  = {
         'zh' : { 'flag' : 'cn' , 'name' : 'Chinese' },
         'en' : { 'flag' : 'us' , 'name' : 'English' }
}
```
截图演示如下：
- vim /app/docker/pythonpath_dev/superset_config.py

![修改配置文件的语言配置.png](https://github.com/yangxifi/spark-study/blob/master/picture/superset-chinese-tutorial/%E4%BF%AE%E6%94%B9%E9%85%8D%E7%BD%AE%E6%96%87%E4%BB%B6%E7%9A%84%E8%AF%AD%E8%A8%80%E9%85%8D%E7%BD%AE.png?raw=true)

5.修改完成，重启容器superset_app
```
sudo docker restart superset_app
```

6.浏览器重新打开superset登录页面，登录后验证汉化是否成功
- 首次登录默认用户名和密码都是admin，记得更改强度高的密码
- 再查看页面，汉化成功，如下图
  ![汉化成功演示.png](https://github.com/yangxifi/spark-study/blob/master/picture/superset-chinese-tutorial/%E6%B1%89%E5%8C%96%E6%88%90%E5%8A%9F%E6%BC%94%E7%A4%BA.png?raw=true)

drop table if exists cccs_flow;
drop table if exists cccs_http;
drop table if exists cccs_geo;
drop table if exists employees;
drop table if exists actions;
drop table if exists domains;
drop table if exists cccs_aad;
drop table if exists cccs_domains_lookup;
drop table if exists cccs_virus_total;
drop table if exists cccs_blocked_domains;


create table cccs_flow as (
    select
    event_time,
    src_port,
    dst_port,
    src_ip_num,
    dst_ip_num,
    city,
    city_dest,
    CONCAT(
    MOD(src_ip_num/16777216, 256) , '.',
    MOD(src_ip_num/65536, 256), '.',
    MOD(src_ip_num/256, 256), '.',
    MOD(src_ip_num, 256)
    ) as src_ip_string,
    CONCAT(
    MOD(dst_ip_num/16777216, 256) , '.',
    MOD(dst_ip_num/65536, 256), '.',
    MOD(dst_ip_num/256, 256), '.',
    MOD(dst_ip_num, 256)
    ) as dst_ip_string
    from (
        select "ds" as event_time,
        "AIR_TIME" as src_port,
        "ARRIVAL_TIME" as dst_port,
        (33*256*256*256) - CAST(ABS("LATITUDE" * "LONGITUDE" * 1000) as BIGINT ) as src_ip_num,
        (33*256*256*256) - CAST(ABS("LATITUDE_DEST" * "LONGITUDE_DEST" * 1000) as BIGINT) as dst_ip_num,
        "CITY" as city,
        "CITY_DEST" as city_dest
        from "flights"
    ) t

);


create table cccs_http as (
    select
    event_time,
    src_port,
    dst_port,
    src_ip_num,
    dst_ip_num,
    domain,
    uri,
    CONCAT(
    MOD(src_ip_num/16777216, 256) , '.',
    MOD(src_ip_num/65536, 256), '.',
    MOD(src_ip_num/256, 256), '.',
    MOD(src_ip_num, 256)
    ) as src_ip_string,
    CONCAT(
    MOD(dst_ip_num/16777216, 256) , '.',
    MOD(dst_ip_num/65536, 256), '.',
    MOD(dst_ip_num/256, 256), '.',
    MOD(dst_ip_num, 256)
    ) as dst_ip_string
    from (
        select "ds" as event_time,
        "AIR_TIME" as src_port,
        "ARRIVAL_TIME" as dst_port,
        CAST((33*256*256*256) - ABS("LATITUDE" * "LONGITUDE" * 1000) as INTEGER) as src_ip_num,
        CAST((33*256*256*256) - ABS("LATITUDE_DEST" * "LONGITUDE_DEST" * 1000) as INTEGER) as dst_ip_num,
        "CITY" as domain,
        "CITY_DEST" as uri
        from "flights"
    ) t
);


create table cccs_geo as (

select
    start_ip_num,
    end_ip_num,
    city,
    city_dst,
    CONCAT(
    MOD(start_ip_num/16777216, 256) , '.',
    MOD(start_ip_num/65536, 256), '.',
    MOD(start_ip_num/256, 256), '.',
    MOD(start_ip_num, 256)
    ) as start_ip_string,
    CONCAT(
    MOD(end_ip_num/16777216, 256) , '.',
    MOD(end_ip_num/65536, 256), '.',
    MOD(end_ip_num/256, 256), '.',
    MOD(end_ip_num, 256)
    ) as end_ip_string,
    case 
      when  MOD(end_ip_num, 256) % 5 = 0 then 'Canada'
      when  MOD(end_ip_num, 256) % 5 = 1 then 'Austria'
      when  MOD(end_ip_num, 256) % 5 = 2 then 'Belarus'
      when  MOD(end_ip_num, 256) % 5 = 3 then 'Chile'
      else 'Zimbabwe'
    end as country
    from (
        select
        CAST(((i-1) * 70000) as BIGINT ) as start_ip_num,
        CAST(((i * 70000) - 1)  as BIGINT ) as end_ip_num,
        "CITY" as city,
        "CITY_DEST" as city_dst
        from (
          select
            "CITY",
            "CITY_DEST",
            row_number() over () AS i
          from "flights"
        ) x
    ) t
);



 
 
 
 
 


CREATE TABLE employees (
	employee_id serial PRIMARY KEY,
	full_name VARCHAR NOT NULL,
	manager_id INT
);




INSERT INTO employees (
	employee_id,
	full_name,
	manager_id
)
VALUES
	(1, 'Michael North', 0),
	(2, 'Megan Berry', 1),
	(3, 'Sarah Berry', 1),
	(4, 'Zoe Black', 1),
	(5, 'Tim James', 1),
	(6, 'Bella Tucker', 2),
	(7, 'Ryan Metcalfe', 2),
	(8, 'Max Mills', 2),
	(9, 'Benjamin Glover', 2),
	(10, 'Carolyn Henderson', 3),
	(11, 'Nicola Kelly', 3),
	(12, 'Alexandra Climo', 3),
	(13, 'Dominic King', 3),
	(14, 'Leonard Gray', 4),
	(15, 'Eric Rampling', 4),
	(16, 'Piers Paige', 7),
	(17, 'Ryan Henderson', 7),
	(18, 'Frank Tucker', 8),
	(19, 'Nathan Ferguson', 8),
	(20, 'Kevin Rampling', 8);





CREATE TABLE actions (
	id INT,
	action_name VARCHAR NOT NULL
);



INSERT INTO actions (
	id,
	action_name
)
VALUES
	(0, 'Login'),
	(1, 'Login Out'),
	(2, 'Expired'),
	(3, 'Failed Login'),
	(4, 'Wrong Password');

 


create table cccs_aad as ( 	
select
    event_time, 
    ip_num, 
    domain, 
    action_name, 
    full_name,
    CONCAT(
    MOD(ip_num/16777216, 256) , '.',
    MOD(ip_num/65536, 256), '.',
    MOD(ip_num/256, 256), '.',
    MOD(ip_num, 256)
    ) as ip_string
from
  (
    select
      "ds" as event_time,
      CAST((33*255*255*255) - ABS("LATITUDE" * "LONGITUDE" * 1000) as INTEGER) as ip_num,
      cast("FLIGHT_NUMBER" as integer) % 20 as userid,
      cast("WHEELS_OFF" as integer) % 5 as action_id,
      "CITY_DEST" as domain
    from
      "flights"
  ) ad,
  actions a,
  employees e
where
  ad.userid = e.employee_id and
  ad.action_id = a.id
);



create table cccs_virus_total as (
select 
  src_ip_string as ip_string,
  src_ip_num as ip_num,
  src_ip_num % 5 as malicious_level
  from (
  select distinct 
    src_ip_string,
    src_ip_num 
  from cccs_flow 
  ) t
);





CREATE TABLE domains (
	id INT,
	domain_name VARCHAR NOT NULL
);



INSERT INTO domains (
	id,
	domain_name
)
VALUES
(1, 'google.com'),
(2, 'youtube.com'),
(3, 'tmall.com'),
(4, 'sohu.com'),
(5, 'qq.com'),
(6, 'baidu.com'),
(7, 'facebook.com'),
(8, '360.cn'),
(9, 'taobao.com'),
(10, 'jd.com'),
(11, 'amazon.com'),
(12, 'yahoo.com'),
(13, 'wikipedia.org'),
(14, 'sina.com.cn'),
(15, 'weibo.com'),
(16, 'xinhuanet.com'),
(17, 'netflix.com'),
(18, 'reddit.com'),
(19, 'live.com'),
(20, 'zhanqi.tv'),
(21, 'instagram.com'),
(22, 'alipay.com'),
(23, 'panda.tv'),
(24, 'vk.com'),
(25, 'google.com.hk'),
(26, 'bing.com'),
(27, 'twitch.tv'),
(28, 'microsoft.com'),
(29, 'csdn.net'),
(30, 'okezone.com'),
(31, 'zoom.us'),
(32, 'yahoo.co.jp'),
(33, 'myshopify.com'),
(34, 'bongacams.com'),
(35, 'ebay.com'),
(36, 'aliexpress.com'),
(37, 'office.com'),
(38, 'stackoverflow.com'),
(39, 'yy.com'),
(40, 'twitter.com'),
(41, 'naver.com'),
(42, 'tianya.cn'),
(43, 'amazon.in'),
(44, 'huanqiu.com'),
(45, 'adobe.com'),
(46, 'microsoftonline.com'),
(47, 'apple.com'),
(48, 'amazon.co.jp'),
(49, '17ok.com'),
(50, 'aparat.com'),
(51, 'ok.ru'),
(52, 'chaturbate.com'),
(53, 'fiverr.com'),
(54, 'yandex.ru'),
(55, 'haosou.com'),
(56, 'linkedin.com'),
(57, 'wordpress.com'),
(58, 'mail.ru'),
(59, 'so.com'),
(60, 'fandom.com'),
(61, 'xvideos.com'),
(62, 'whatsapp.com'),
(63, 'imdb.com'),
(64, '1688.com'),
(65, 'google.com.br'),
(66, 'google.co.in'),
(67, 'medium.com'),
(68, 'pornhub.com'),
(69, 'etsy.com'),
(70, 'msn.com'),
(71, 'tribunnews.com'),
(72, 'roblox.com'),
(73, 'tradingview.com'),
(74, 'google.de'),
(75, 'hao123.com'),
(76, 'bilibili.com'),
(77, 'savefrom.net'),
(78, 'indeed.com'),
(79, 'dropbox.com'),
(80, 'rakuten.co.jp'),
(81, 'livejasmin.com'),
(82, 'babytree.com'),
(83, 'canva.com'),
(84, 'xhamster.com'),
(85, 'udemy.com'),
(86, 'primevideo.com'),
(87, 'gome.com.cn'),
(88, 'chase.com'),
(89, 'tiktok.com'),
(90, 'paypal.com'),
(91, '163.com'),
(92, 'google.co.jp'),
(93, 'rednet.cn'),
(94, '6.cn'),
(95, 'kompas.com'),
(96, 'amazon.de'),
(97, 'imgur.com'),
(98, 'walmart.com'),
(99, 'digikala.com'),
(100, 'instructure.com');




create table cccs_domains_lookup as (
  select 
    f.src_ip_string as ip_string,
    f.src_ip_num as ip_num,
    d.domain_name as domain_name 
  from (select distinct src_ip_string, src_ip_num from cccs_flow) f
  inner join domains d
  on (f.src_ip_num % 100) = d.id
  );

create table cccs_blocked_domains as (
  select 
  domain_name,
  random() > 0.5 as quad_nine_block,
  random() > 0.5 as google_block,
  random() > 0.5 as cloud_flare_block,
  random() > 0.5 as open_dns_block,
  random() > 0.5 as cira_block
  from (select distinct domain_name from cccs_domains_lookup) t
);














### Simple numerics

```javascript
>>> ['10',9,2,'1','4'].sort(naturalSort)
['1',2,'4',9,'10']
```

### Floats

```javascript
>>> ['10.0401',10.022,10.042,'10.021999'].sort(naturalSort)
['10.021999',10.022,'10.0401',10.042]
```

### Float & decimal notation

```javascript
>>> ['10.04f','10.039F','10.038d','10.037D'].sort(naturalSort)
['10.037D','10.038d','10.039F','10.04f']
```

### Scientific notation

```javascript
>>> ['1.528535047e5','1.528535047e7','1.528535047e3'].sort(naturalSort)
['1.528535047e3','1.528535047e5','1.528535047e7']
```

### IP addresses

```javascript
>>> ['192.168.0.100','192.168.0.1','192.168.1.1'].sort(naturalSort)
['192.168.0.1','192.168.0.100','192.168.1.1']
```

### Filenames

```javascript
>>> ['car.mov','01alpha.sgi','001alpha.sgi','my.string_41299.tif'].sort(naturalSort)
['001alpha.sgi','01alpha.sgi','car.mov','my.string_41299.tif'
```

### Dates

```javascript
>>> ['10/12/2008','10/11/2008','10/11/2007','10/12/2007'].sort(naturalSort)
['10/11/2007', '10/12/2007', '10/11/2008', '10/12/2008']
```

### Money

```javascript
>>> ['$10002.00','$10001.02','$10001.01'].sort(naturalSort)
['$10001.01','$10001.02','$10002.00']
```

### Movie Titles

```javascript
>>> ['1 Title - The Big Lebowski','1 Title - Gattaca','1 Title - Last Picture Show'].sort(naturalSort)
['1 Title - Gattaca','1 Title - Last Picture Show','1 Title - The Big Lebowski']
```

### By default - case-sensitive sorting

```javascript
>>> ['a', 'B'].sort(naturalSort);
['B', 'a']
```

### To enable case-insensitive sorting
```javascript
>>> naturalSort.insensitive = true;
>>> ['a', 'B'].sort(naturalSort);
['a', 'B']
```

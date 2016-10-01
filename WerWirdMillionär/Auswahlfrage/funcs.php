<?
	function sql_init () {
		$host 	= "localhost";
		$user 	= "wwm";
		$pass 	= "gjauch";
		$dbname = "wwm";
		$mysql	= mysql_connect($host,$user,$pass);
		mysql_select_db($dbname,$mysql);
		echo mysql_error();
		return ($mysql);
	}

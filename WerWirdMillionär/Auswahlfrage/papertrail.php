<?	
        include "funcs.php";
        $mysql = sql_init();
	$mailtext = "";
	$data = $_REQUEST["payload"];           
	$unescaped_data = stripslashes($data);
	$obj = json_decode($unescaped_data);
	foreach ( $obj->events as $e ) {
		if ( preg_match("/info\s(\w+)\ssetAnswer\s(\d)\sright\sis\s(\d)\sfor\squestion\s(\d+)/", $e->message, $matches)) {
			$id = $matches[1];
			$query  = "UPDATE games SET total = total + 1 WHERE id = \"$id\"";
			$mailtext .= $query . " Stufe " . $matches[4] . "\n";
			$result = mysql_query($query,$mysql);
			echo mysql_error($mysql);
			if ( $matches[2] != $matches[3] ) {
				$query  = "UPDATE games SET mistakes = mistakes + 1 WHERE id = \"$id\"";
				$mailtext .= $query . "\n";
				$result = mysql_query($query,$mysql);
			} elseif ( $matches[4] == "14" ) {
				$query  = "UPDATE games SET completed = 1, endtime = NOW()  WHERE id = \"$id\"";
				$mailtext .= $query . "\n";
				$result = mysql_query($query,$mysql);
			}
		}
	}
	@mail("geochecker@jachmann.de", "WWM Logs", $mailtext);

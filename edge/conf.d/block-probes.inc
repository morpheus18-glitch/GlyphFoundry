location ~* ^/(phpmyadmin|phpMyAdmin|_phpmyadmin|dbadmin|sql|db|phpMyAdmin-.*|phpMyAdmin[0-9\.]+)/ { return 444; }
location ~* \.php$ { return 444; }
